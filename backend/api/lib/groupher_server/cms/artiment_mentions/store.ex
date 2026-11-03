defmodule GroupherServer.CMS.ArtimentMentions.Store do
  @moduledoc """
  Stores stable Mention facts and synchronizes each canonical public source.

      canonical BodyBag -> parsed targets -> locked fact replacement + synced token
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.ErrorCat

  alias CMS.{
    Artiment.Matcher,
    Artiment.PlateJSON,
    ArtimentMentions.Config,
    ArtimentMentions.CanonicalSource,
    ArtimentMentions.GraphRevision,
    ArtimentMentions.SyncProgress,
    ArtimentMentions.Parser,
    Articles.Bindings,
    FrontDesk
  }

  alias CMS.Model.{Article, ArticlePublic, ArtimentMention, Comment, CommentBody, DocPublic}
  alias Helper.{ORM, T}
  alias Helper.ORM.Pagi.{Order}
  alias GroupherServer.{Pagi}
  alias Pagi.Params

  @threads Config.threads()
  @mention_types Config.mention_types()

  @type target_state :: :active | :trashed | :permanently_deleted
  @type sync_output :: :pass | {non_neg_integer(), nil}
  @type sync_result :: {:ok, sync_output()} | {:error, term()}
  @typep artiment_context :: %{required(:artiment) => term()}

  @doc """
  Rebuilds all Mention facts emitted by one Article or Comment.

      canonical body/document
               |
               v
      parse + batch-resolve targets
               |
               v
      build snapshots + merge occurrences
               |
               v
      delete old facts + batch insert current facts

  Comment parent Articles are resolved once and then carried as snapshot
  context; snapshot construction must not perform queries per occurrence.
  """
  @spec sync(Comment.t() | T.article() | map()) :: sync_result()
  def sync(%Comment{id: comment_id}) when is_integer(comment_id),
    do: sync_current_legacy(%{type: :comment, comment_id: comment_id})

  def sync(%{article_id: article_id, thread: thread} = source)
      when is_binary(article_id) and thread in [:post, :blog, :changelog, :ticket, :doc] do
    sync_current_legacy(%{
      type: thread,
      article_id: article_id,
      branch_id: Map.get(source, :branch_id)
    })
  end

  def sync(%{id: article_id, thread: thread} = source)
      when is_binary(article_id) and thread in [:post, :blog, :changelog, :ticket, :doc] do
    sync_current_legacy(%{
      type: thread,
      article_id: article_id,
      branch_id: Map.get(source, :branch_id)
    })
  end

  def sync(_), do: {:ok, :pass}

  defp sync_current_legacy(locator) do
    case CanonicalSource.sync_current(locator, []) do
      {:ok, :source_gone} ->
        {:ok, :pass}

      {:error, :source_publication_missing} ->
        if public_head_absent?(locator),
          do: {:ok, :pass},
          else: {:error, :source_publication_missing}

      result ->
        result
    end
  end

  defp public_head_absent?(%{type: :doc, article_id: id, branch_id: branch_id}) do
    is_nil(Repo.get_by(DocPublic, article_id: id, branch_id: branch_id))
  end

  defp public_head_absent?(%{article_id: id}), do: is_nil(Repo.get(ArticlePublic, id))
  defp public_head_absent?(_), do: false

  @doc "Rebuilds a published source against its desired token in one locked transaction."
  def sync_public(source, opts \\ [])

  def sync_public(%{article_id: article_id} = source, opts) when is_binary(article_id) do
    with {:ok, ast} <- load_body_ast(source) do
      Repo.transaction(fn ->
        {state, token} =
          case SyncProgress.lock_current(source) do
            {:ok, result} -> result
            {:error, reason} -> Repo.rollback(reason)
          end

        if state.synced_content_token == token and not Keyword.get(opts, :force, false) do
          :pass
        else
          mentioner_context = artiment_context(source)

          mentions =
            ast
            |> Parser.parse(community_id: community_id(mentioner_context))
            |> Enum.reject(&mentioning_itself?(source, &1))
            |> hydrate_comment_bodies()
            |> Enum.map(&shape(mentioner_context, &1))
            |> merge_occurrences()

          {:ok, _} = delete_by_mentioner(source)
          result = insert_mentions(mentions)
          {:ok, _state} = SyncProgress.mark_synced_in_transaction(state, token)
          {:ok, :pass} = bump_source_graph(source)
          result
        end
      end)
      |> source_gone_result()
    end
  end

  @doc "Rebuilds one current Comment body with its persisted desired token."
  def sync_comment_public(comment, opts \\ [])

  def sync_comment_public(%Comment{} = comment, opts) do
    Repo.transaction(fn ->
      {state, token} =
        case SyncProgress.lock_current(comment) do
          {:ok, result} -> result
          {:error, reason} -> Repo.rollback(reason)
        end

      if state.synced_content_token == token and not Keyword.get(opts, :force, false) do
        :pass
      else
        ast =
          case Repo.get_by(CommentBody, comment_id: comment.id) do
            %CommentBody{version: version, body_hash: hash, json: json}
            when is_binary(json) ->
              if "#{comment.id}:#{version}:#{hash}" == token do
                case PlateJSON.decode(json) do
                  {:ok, decoded} -> decoded
                  {:error, reason} -> Repo.rollback(reason)
                end
              else
                Repo.rollback(:stale_comment_body)
              end

            _ ->
              Repo.rollback(:source_body_missing)
          end

        mentioner_context = artiment_context(comment)

        mentions =
          ast
          |> Parser.parse(community_id: community_id(mentioner_context))
          |> Enum.reject(&mentioning_itself?(comment, &1))
          |> hydrate_comment_bodies()
          |> Enum.map(&shape(mentioner_context, &1))
          |> merge_occurrences()

        {:ok, _} = delete_by_mentioner(comment)
        result = insert_mentions(mentions)
        {:ok, _state} = SyncProgress.mark_synced_in_transaction(state, token)
        {:ok, :pass} = bump_source_graph(comment)
        result
      end
    end)
    |> source_gone_result()
  end

  defp source_gone_result({:error, :source_deleted}), do: {:ok, :source_gone}
  defp source_gone_result(result), do: result

  @doc """
  Removes Mention facts owned by a deleted Comment, or removes outgoing facts
  and preserves incoming deletion snapshots for an Article.
  """
  @spec purge(Comment.t() | T.article() | map()) :: T.domain_res(term())
  def purge(%Comment{} = comment) do
    {type, %{entity_id: id}} = mentioner_identity(comment)

    from(m in ArtimentMention,
      where:
        (m.mentioner_type == ^type and m.mentioner_comment_id == ^id) or
          (m.mentioned_scope == :internal and m.mentioned_type == ^type and
             m.mentioned_comment_id == ^id)
    )
    |> ORM.delete_all(:if_exist)
  end

  def purge(article) do
    with {:ok, _} <- preserve_incoming_deleted(article) do
      purge_outgoing(article)
    end
  end

  @doc "Deletes Mention facts owned by comments that will be cascade-deleted with an Article."
  @spec purge_article_comments(T.article() | map()) :: T.domain_res(term())
  def purge_article_comments(article) do
    with {:ok, thread} <- FrontDesk.thread_of(article),
         {:ok, %{foreign_key: foreign_key}} <- Matcher.match(thread) do
      comment_ids =
        Comment
        |> where([comment], comment.thread == ^thread)
        |> where([comment], field(comment, ^foreign_key) == ^article.id)
        |> select([comment], comment.id)
        |> Repo.all()

      case comment_ids do
        [] ->
          {:ok, :pass}

        ids ->
          from(mention in ArtimentMention,
            where:
              (mention.mentioner_type == :comment and mention.mentioner_comment_id in ^ids) or
                (mention.mentioned_scope == :internal and mention.mentioned_type == :comment and
                   mention.mentioned_comment_id in ^ids)
          )
          |> ORM.delete_all(:if_exist)
      end
    end
  end

  @doc "Deletes Mention rows emitted by an Article that is being permanently deleted."
  @spec purge_outgoing(T.article() | map()) :: T.domain_res(term())
  def purge_outgoing(artiment) do
    {type, identity} = mentioner_identity(artiment)

    ArtimentMention
    |> mentioner_query(type, identity)
    |> ORM.delete_all(:if_exist)
  end

  @doc "Target rows are removed by their FK when a target is permanently deleted."
  def preserve_incoming_deleted(_artiment), do: {:ok, :pass}

  @doc "Lifecycle visibility is evaluated at read time; facts contain no deletion snapshot."
  def mark_target_state(_artiment, _state), do: {:ok, :pass}

  @doc "Pages outgoing Mention facts for an internal source."
  @spec mentions(atom(), T.id(), Params.t() | nil) :: tuple()
  def mentions(type, id, pagi) do
    case normalize_type(type) do
      nil ->
        {:error, ErrorCat.custom("invalid mentioner type")}

      normalized ->
        ArtimentMention
        |> mentioner_list_query(normalized, id)
        |> page_mentions(pagi, {:outgoing, normalized, id})
    end
  end

  @doc """
  Returns distinct user ids directly mentioned by one internal CMS source.

  Callers use this only after confirming the source is currently readable on its
  public surface.

  ## Examples

      Store.mentioned_user_ids(:comment, 42)
      #=> {:ok, [17, 23]} | {:error, reason}
  """
  @spec mentioned_user_ids(atom(), T.id()) :: {:ok, [pos_integer()]} | {:error, term()}
  def mentioned_user_ids(type, id) when is_atom(type) and (is_integer(id) or is_binary(id)) do
    case normalize_type(type) do
      nil ->
        {:error, ErrorCat.custom("invalid mentioner type")}

      normalized ->
        user_ids =
          ArtimentMention
          |> where(
            [mention],
            mention.mentioner_type == ^normalized and mention.mentioned_scope == :internal and
              mention.mentioned_type == :user and not is_nil(mention.mentioned_user_id)
          )
          |> where_mentioner(normalized, id)
          |> select([mention], fragment("DISTINCT ?", mention.mentioned_user_id))
          |> Repo.all()

        {:ok, user_ids}
    end
  end

  def mentioned_user_ids(_type, _id), do: {:error, ErrorCat.custom("invalid mentioner identity")}

  defp where_mentioner(query, type, article_id) when type in @threads do
    where(query, [mention], mention.mentioner_article_id == ^article_id)
  end

  defp where_mentioner(query, _type, comment_id) do
    where(query, [mention], mention.mentioner_comment_id == ^comment_id)
  end

  @doc "Pages incoming Mention facts for an internal target."
  @spec mentioned_by(atom(), T.id(), Params.t() | nil) :: tuple()
  def mentioned_by(type, id, pagi) do
    case normalize_type(type) do
      :url ->
        {:error, ErrorCat.custom("mentioned_by only supports internal targets")}

      nil ->
        {:error, ErrorCat.custom("invalid mentioned type")}

      normalized ->
        ArtimentMention
        |> mentioned_list_query(normalized, id)
        |> visible_mentioners()
        |> page_mentions(pagi, {:incoming, normalized, id})
    end
  end

  defp visible_mentioners(query), do: query

  defp page_mentions(query, pagi, collection) do
    ORM.pagi(query, pagi,
      for: ArtimentMention,
      order: %Order{
        fields: [:inserted_at, :id],
        directions: [:asc, :asc],
        cursor_fields: [:inserted_at, :id]
      },
      surface: "artiment_mentions",
      query_fingerprint:
        :crypto.hash(:sha256, :erlang.term_to_binary(collection)) |> Base.encode16()
    )
  end

  defp mentioner_list_query(query, type, article_id) when type in @threads do
    where(
      query,
      [m],
      m.mentioner_type == ^type and m.mentioner_article_id == ^article_id
    )
  end

  defp mentioner_list_query(query, type, entity_id) do
    where(query, [m], m.mentioner_type == ^type and m.mentioner_comment_id == ^entity_id)
  end

  defp mentioned_list_query(query, type, article_id) when type in @threads do
    where(
      query,
      [m],
      m.mentioned_scope == :internal and m.mentioned_type == ^type and
        m.mentioned_article_id == ^article_id
    )
  end

  defp mentioned_list_query(query, type, entity_id) do
    where(
      query,
      [m],
      m.mentioned_scope == :internal and m.mentioned_type == ^type and
        m.mentioned_comment_id == ^entity_id
    )
  end

  defp bump_source_graph(%Comment{} = comment), do: GraphRevision.bump_for_comment(comment)

  defp bump_source_graph(%{article_id: article_id}) when is_binary(article_id) do
    GraphRevision.bump_for_article(article_id)
  end

  defp delete_by_mentioner(artiment) do
    {mentioner_type, identity} = mentioner_identity(artiment)

    ArtimentMention
    |> mentioner_query(mentioner_type, identity)
    |> ORM.delete_all(:if_exist)
  end

  defp mentioner_query(query, type, %{entity_id: id}) do
    where(query, [m], m.mentioner_type == ^type and m.mentioner_comment_id == ^id)
  end

  defp mentioner_query(query, type, %{article_id: article_id, branch_id: nil}) do
    where(
      query,
      [m],
      m.mentioner_type == ^type and m.mentioner_article_id == ^article_id and
        is_nil(m.mentioner_branch_id)
    )
  end

  defp mentioner_query(query, type, %{article_id: article_id, branch_id: branch_id}) do
    where(
      query,
      [m],
      m.mentioner_type == ^type and m.mentioner_article_id == ^article_id and
        m.mentioner_branch_id == ^branch_id
    )
  end

  defp insert_mentions([]), do: :pass

  defp insert_mentions(mentions) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    mentions =
      Enum.map(mentions, fn mention ->
        Map.merge(mention, %{inserted_at: now, updated_at: now})
      end)

    Repo.insert_all(ArtimentMention, mentions)
  end

  defp shape(%{artiment: artiment}, mention) do
    {mentioner_type, source} = mentioner_identity(artiment)
    target_type = mention.mentioned_type
    target_id = Map.get(mention, :mentioned_id)

    %{
      mentioner_type: mentioner_type,
      mentioner_article_id: Map.get(source, :article_id),
      mentioner_comment_id: Map.get(source, :entity_id),
      mentioner_branch_id: Map.get(source, :branch_id),
      mentioned_scope: mention.mentioned_scope,
      mentioned_type: target_type,
      mentioned_article_id: if(target_type in @threads, do: target_id, else: nil),
      mentioned_comment_id: if(target_type == :comment, do: target_id, else: nil),
      mentioned_user_id: if(target_type == :user, do: target_id, else: nil),
      mentioned_branch_id:
        if(target_type in [:doc, :comment],
          do: get_in(mention, [:artiment, :branch_id]),
          else: nil
        ),
      external_url:
        if(mention.mentioned_scope == :external, do: Map.get(mention, :mentioned_url), else: nil),
      external_url_hash:
        if(mention.mentioned_scope == :external,
          do: Map.get(mention, :mentioned_url_hash),
          else: nil
        ),
      mention_case: mention.mention_case,
      occurrences: [mention.occurrence],
      mentioned_at: DateTime.truncate(artiment.updated_at, :second)
    }
  end

  @spec artiment_context(term()) :: artiment_context()
  defp artiment_context(artiment), do: %{artiment: artiment}

  defp merge_occurrences(mentions) do
    {keys, mentions_by_key} =
      Enum.reduce(mentions, {[], %{}}, fn mention, {keys, mentions_by_key} ->
        key = merge_key(mention)
        mention = Map.update!(mention, :occurrences, &Enum.reverse/1)

        case Map.fetch(mentions_by_key, key) do
          :error ->
            {[key | keys], Map.put(mentions_by_key, key, mention)}

          {:ok, existing} ->
            merged =
              Map.update!(existing, :occurrences, fn occurrences ->
                mention.occurrences ++ occurrences
              end)

            {keys, Map.put(mentions_by_key, key, merged)}
        end
      end)

    keys
    |> Enum.reverse()
    |> Enum.map(fn key ->
      mentions_by_key
      |> Map.fetch!(key)
      |> Map.update!(:occurrences, &Enum.reverse/1)
    end)
  end

  defp merge_key(mention) do
    [
      mention.mentioner_type,
      mention.mentioner_article_id,
      mention.mentioner_comment_id,
      mention.mentioner_branch_id,
      mention.mentioned_scope,
      mention.mentioned_type,
      mention.mentioned_article_id,
      mention.mentioned_comment_id,
      mention.mentioned_user_id,
      mention.mentioned_branch_id,
      mention.external_url_hash,
      mention.mention_case
    ]
  end

  defp load_body_ast(%{body: %{json: json}}) when is_binary(json) do
    PlateJSON.decode(json)
  end

  defp mentioner_identity(%Comment{id: id, branch_id: branch_id}) do
    {:comment, %{entity_id: id, branch_id: branch_id}}
  end

  defp mentioner_identity(%Article{id: article_id, thread: thread}) do
    {thread, %{article_id: article_id, branch_id: nil}}
  end

  defp mentioner_identity(%{article_id: article_id} = article) when is_binary(article_id) do
    {:ok, thread} = FrontDesk.thread_of(article)
    {thread, %{article_id: article_id, branch_id: Map.get(article, :branch_id)}}
  end

  defp mentioner_identity(article) do
    {:ok, thread} = FrontDesk.thread_of(article)
    {thread, %{entity_id: article.id}}
  end

  defp community_id(%{artiment: %Comment{}}), do: nil

  defp community_id(%{artiment: %{community_id: community_id}})
       when is_integer(community_id) do
    community_id
  end

  defp community_id(%{artiment: article}) when is_map(article) do
    case explicit_community_id(article) do
      community_id when is_integer(community_id) ->
        community_id

      _ ->
        case Bindings.get(article, Map.get(article, :community)) do
          {:ok, %{community: %{id: community_id}}} -> community_id
          _ -> nil
        end
    end
  end

  defp community_id(_), do: nil

  defp explicit_community_id(article) do
    case :maps.find(:community_id, article) do
      {:ok, community_id} -> community_id
      :error -> nil
    end
  end

  defp hydrate_comment_bodies(mentions) do
    comment_ids =
      mentions
      |> Enum.flat_map(fn
        %{artiment: %Comment{id: id}} -> [id]
        _ -> []
      end)
      |> Enum.uniq()

    bodies =
      CommentBody
      |> where([body], body.comment_id in ^comment_ids)
      |> Repo.all()
      |> Map.new(&{&1.comment_id, &1})

    Enum.map(mentions, fn
      %{artiment: %Comment{id: id} = comment} = mention ->
        Map.put(mention, :artiment, %{comment | body: Map.get(bodies, id)})

      mention ->
        mention
    end)
  end

  defp mentioning_itself?(%Comment{id: id}, %{mentioned_type: :comment, mentioned_id: id}) do
    true
  end

  defp mentioning_itself?(%Comment{} = comment, %{mentioned_type: :user, mentioned_id: user_id}) do
    comment.author_id == user_id
  end

  defp mentioning_itself?(article, %{mentioned_type: :user, mentioned_id: user_id}) do
    case FrontDesk.article_author(article) do
      {:ok, %{id: ^user_id}} -> true
      _ -> false
    end
  end

  # A Comment is its own source even when it links to its parent Article.
  defp mentioning_itself?(%Comment{}, %{mentioned_type: type}) when type in @threads, do: false

  defp mentioning_itself?(article, %{mentioned_type: mentioned_type, mentioned_id: id})
       when mentioned_type in @threads do
    case FrontDesk.thread_of(article) do
      {:ok, ^mentioned_type} -> stable_or_entity_id(article) == id
      _ -> false
    end
  end

  defp mentioning_itself?(_, _), do: false

  defp stable_or_entity_id(%{article_id: article_id}) when is_binary(article_id), do: article_id
  defp stable_or_entity_id(%{id: id}), do: id

  defp normalize_type(type) when is_binary(type) do
    normalized = String.downcase(type)
    Enum.find(@mention_types, &(Atom.to_string(&1) == normalized))
  end

  defp normalize_type(type) when type in @mention_types, do: type
  defp normalize_type(_), do: nil
end
