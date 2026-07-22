defmodule GroupherServer.CMS.ArtimentMentions do
  @moduledoc """
  Stores the product-level mention graph for CMS artiments.

  In product language, a mention means "this content mentioned another entity".
  `mentioner_*` always points to the artiment that contains the mention, while
  `mentioned_*` points to the entity or external URL being mentioned.

  Examples:

    * post A links to blog B:
      `mentioner_type = :post`, `mentioner_id = A.id`,
      `mentioner_community_id = A.community_id`,
      `mentioned_scope = :internal`, `mentioned_type = :blog`,
      `mentioned_id = B.id`, `mentioned_community_id = B.community_id`,
      `mention_case = :inline_mention`

    * comment A mentions user B with an inline mention:
      `mentioner_type = :comment`, `mentioner_id = A.id`,
      `mentioner_community_id = A.article.community_id`,
      `mentioned_scope = :internal`, `mentioned_type = :user`,
      `mentioned_id = B.id`, `mention_case = :inline_mention`

    * post A links to an external URL:
      `mentioner_type = :post`, `mentioner_id = A.id`,
      `mentioner_community_id = A.community_id`,
      `mentioned_scope = :external`, `mentioned_type = :url`,
      `mentioned_url = "https://..."`, `mention_case = :link`

  Important rules:

    * Internal URLs are normalized to inline mentions. A pasted
      `https://groupher.com/post/123` is stored the same way as an editor
      inline mention of that post.
    * `:url` is only for external links. Internal content and users are always
      represented by their concrete type and id.
    * Community ids are first-class query dimensions. `mentioner_community_id`
      is required because the mentioner is always CMS content; `mentioned_community_id`
      is filled for mentioned articles/comments and left empty for users and URLs.
    * `sync/1` rebuilds mentions for one mentioner by deleting its old rows and
      inserting the current parse result. This handles the common update case
      where a user removes or changes a mention in the editor.
    * Self mentions are ignored: an article/comment mentioning itself is not
      stored, and an author mentioning their own user account is not stored.
    * `occurrences` keeps block-level locations and raw input details so the UI
      can jump to the exact paragraph and debug parser normalization.

  This module is the fact store only. Notification behavior should consume
  these facts downstream instead of being coupled to sync.
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, get_config: 2]
  import ShortMaps

  alias GroupherServer.{CMS, Repo}
  alias CMS.{Artiment.Matcher, Artiment.PlateJSON, ArtimentMentions.Parser, FrontDesk}
  alias CMS.Model.{ArtimentMention, Comment}
  alias Helper.{ORM, QueryBuilder, T}

  @threads get_config(:article, :threads)
  @mention_types @threads ++ [:comment, :user, :url]

  @type target_state :: :active | :trashed | :permanently_deleted
  @type sync_output :: :pass | {non_neg_integer(), nil}
  @type sync_result :: {:ok, sync_output()} | {:error, term()}
  @typep artiment_context :: %{
           required(:artiment) => term(),
           optional(:parent_article) => T.article() | nil
         }

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
  def sync(%{body: body} = artiment) when is_binary(body) do
    with {:ok, ast} <- PlateJSON.decode(body),
         {:ok, artiment} <- FrontDesk.preload_author(artiment) do
      do_sync(artiment, ast)
    end
  end

  def sync(%{document: _document} = article) do
    with {:ok, ast} <- load_document_ast(article),
         {:ok, article} <- FrontDesk.preload_author(article) do
      do_sync(article, ast)
    end
  end

  def sync(_), do: {:ok, :pass}

  @doc """
  Removes Mention facts owned by a deleted Comment, or removes outgoing facts
  and preserves incoming deletion snapshots for an Article.
  """
  @spec purge(Comment.t() | T.article() | map()) :: T.domain_res(term())
  def purge(%Comment{} = comment) do
    {type, id} = mentioner_identity(comment)

    from(m in ArtimentMention,
      where:
        (m.mentioner_type == ^type and m.mentioner_id == ^id) or
          (m.mentioned_scope == :internal and m.mentioned_type == ^type and m.mentioned_id == ^id)
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
              (mention.mentioner_type == :comment and mention.mentioner_id in ^ids) or
                (mention.mentioned_scope == :internal and mention.mentioned_type == :comment and
                   mention.mentioned_id in ^ids)
          )
          |> ORM.delete_all(:if_exist)
      end
    end
  end

  @doc "Deletes Mention rows emitted by an Article that is being permanently deleted."
  @spec purge_outgoing(T.article() | map()) :: T.domain_res(term())
  def purge_outgoing(artiment) do
    {type, id} = mentioner_identity(artiment)

    from(m in ArtimentMention,
      where: m.mentioner_type == ^type and m.mentioner_id == ^id
    )
    |> ORM.delete_all(:if_exist)
  end

  @doc "Keeps incoming Mention facts and marks their stored target snapshot as permanently deleted."
  @spec preserve_incoming_deleted(T.article() | map()) :: T.domain_res(:pass)
  def preserve_incoming_deleted(artiment) do
    mark_target_state(artiment, :permanently_deleted)
  end

  @doc """
  Updates stored target snapshots so Mention UIs can render deletion badges.

      target identity + lifecycle state
                    |
                    v
      select matching incoming facts
                    |
                    v
      one JSONB UPDATE for snapshot + meta + updated_at

  The update is atomic as one SQL statement. Article lifecycle callers still
  own the surrounding lock/transaction that coordinates this write with the
  rest of trash, restore, or permanent deletion.
  """
  @spec mark_target_state(T.article() | map(), target_state()) :: T.domain_res(:pass)
  def mark_target_state(artiment, state)
      when state in [:active, :trashed, :permanently_deleted] do
    {type, id} = mentioner_identity(artiment)
    updated_at = DateTime.utc_now(:second)
    changed_at = DateTime.to_iso8601(updated_at)

    query =
      ArtimentMention
      |> where(
        [m],
        m.mentioned_scope == :internal and m.mentioned_type == ^type and m.mentioned_id == ^id
      )

    query
    |> update_target_state(state, changed_at, updated_at)
    |> Repo.update_all([])

    {:ok, :pass}
  end

  defp update_target_state(query, :active, _changed_at, updated_at) do
    update(query, [m],
      set: [
        mentioned_snapshot:
          fragment(
            "COALESCE(?, '{}'::jsonb) - 'deletionState' - 'deletedAt'",
            m.mentioned_snapshot
          ),
        meta:
          fragment(
            "COALESCE(?, '{}'::jsonb) - 'mentionedDeleted' - 'mentionedTrashed' - 'mentionedDeletedAt'",
            m.meta
          ),
        updated_at: ^updated_at
      ]
    )
  end

  defp update_target_state(query, state, changed_at, updated_at) do
    snapshot_patch = %{
      "deletionState" => to_string(state),
      "deletedAt" => changed_at
    }

    meta_patch = %{
      "mentionedDeleted" => true,
      "mentionedTrashed" => state == :trashed,
      "mentionedDeletedAt" => changed_at
    }

    update(query, [m],
      set: [
        mentioned_snapshot:
          fragment(
            "COALESCE(?, '{}'::jsonb) || ?",
            m.mentioned_snapshot,
            type(^snapshot_patch, :map)
          ),
        meta: fragment("COALESCE(?, '{}'::jsonb) || ?", m.meta, type(^meta_patch, :map)),
        updated_at: ^updated_at
      ]
    )
  end

  @doc "Lists Mention facts emitted by one internal Article or Comment."
  @spec mentions(atom(), T.id(), map() | nil) :: T.domain_res(T.paged_data())
  def mentions(mentioner_type, mentioner_id, nil),
    do: mentions(mentioner_type, mentioner_id, %{page: 1, size: 20})

  def mentions(mentioner_type, mentioner_id, %{page: page, size: size} = filter) do
    ArtimentMention
    |> where(
      [m],
      m.mentioner_type == ^normalize_type(mentioner_type) and m.mentioner_id == ^mentioner_id
    )
    |> QueryBuilder.filter_pack(Map.merge(filter, %{sort: :asc_inserted}))
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  @doc "Lists incoming Mention facts for one internal target."
  @spec mentioned_by(atom(), T.id(), map() | nil) :: T.domain_res(T.paged_data())
  def mentioned_by(mentioned_type, mentioned_id, nil),
    do: mentioned_by(mentioned_type, mentioned_id, %{page: 1, size: 20})

  def mentioned_by(mentioned_type, mentioned_id, %{page: page, size: size} = filter) do
    case normalize_type(mentioned_type) do
      :url ->
        {:error, {:custom, "mentioned_by only supports internal targets"}}

      nil ->
        {:error, {:custom, "invalid mentioned type"}}

      normalized_type ->
        ArtimentMention
        |> where(
          [m],
          m.mentioned_scope == :internal and
            m.mentioned_type == ^normalized_type and
            m.mentioned_id == ^mentioned_id
        )
        |> QueryBuilder.filter_pack(Map.merge(filter, %{sort: :asc_inserted}))
        |> ORM.paginator(~m(page size)a)
        |> done()
    end
  end

  defp do_sync(artiment, ast) do
    mentioner_context = artiment_context(artiment)

    mentions =
      ast
      |> Parser.parse()
      |> Enum.reject(&mentioning_itself?(artiment, &1))
      |> Enum.map(&shape(mentioner_context, &1))
      |> merge_occurrences()

    Repo.transaction(fn ->
      {:ok, _} = delete_by_mentioner(artiment)
      insert_mentions(mentions)
    end)
    |> case do
      {:ok, result} -> {:ok, result}
      {:error, reason} -> {:error, reason}
    end
  end

  defp delete_by_mentioner(artiment) do
    {mentioner_type, mentioner_id} = mentioner_identity(artiment)

    from(m in ArtimentMention,
      where: m.mentioner_type == ^mentioner_type and m.mentioner_id == ^mentioner_id
    )
    |> ORM.delete_all(:if_exist)
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

  defp shape(%{artiment: artiment} = mentioner_context, mention) do
    {mentioner_type, mentioner_id} = mentioner_identity(artiment)
    mentioned_at = artiment.updated_at |> DateTime.truncate(:second)
    mentioned_context = mentioned_context(mention)

    %{
      mentioner_type: mentioner_type,
      mentioner_id: mentioner_id,
      mentioner_community_id: community_id(mentioner_context),
      mentioner_url: artiment_url(mentioner_context),
      mentioned_scope: mention.mentioned_scope,
      mentioned_type: mention.mentioned_type,
      mentioned_id: Map.get(mention, :mentioned_id),
      mentioned_community_id: community_id(mentioned_context),
      mentioned_url: Map.get(mention, :mentioned_url),
      mentioned_url_hash: Map.get(mention, :mentioned_url_hash),
      mention_case: mention.mention_case,
      occurrences: [mention.occurrence],
      mentioner_snapshot: snapshot(mentioner_context),
      mentioned_snapshot: snapshot(mentioned_context, mention),
      meta: %{},
      mentioned_at: mentioned_at
    }
  end

  @spec artiment_context(term()) :: artiment_context()
  defp artiment_context(%Comment{} = comment) do
    parent_article =
      case FrontDesk.article_of(comment) do
        {:ok, article} -> article
        _ -> nil
      end

    %{artiment: comment, parent_article: parent_article}
  end

  defp artiment_context(artiment), do: %{artiment: artiment}

  defp mentioned_context(mention) do
    %{
      artiment: Map.get(mention, :artiment),
      parent_article: Map.get(mention, :parent_article)
    }
  end

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
      mention.mentioner_id,
      mention.mentioned_scope,
      mention.mentioned_type,
      mention.mentioned_id,
      mention.mentioned_community_id,
      mention.mentioned_url_hash,
      mention.mention_case
    ]
  end

  defp load_document_ast(article) do
    case Repo.preload(article, :document, force: true) |> get_in([:document, :json]) do
      nil -> {:ok, []}
      json when is_binary(json) -> PlateJSON.decode(json)
      _ -> {:error, {:custom, "invalid json body"}}
    end
  end

  defp mentioner_identity(%Comment{id: id}), do: {:comment, id}

  defp mentioner_identity(article) do
    {:ok, thread} = FrontDesk.thread_of(article)
    {thread, article.id}
  end

  defp artiment_url(%{artiment: %Comment{} = comment, parent_article: article})
       when is_map(article) do
    with {:ok, thread} <- FrontDesk.thread_of(article) do
      "#{article_url(thread, article.id)}?comment_id=#{comment.id}"
    else
      _ -> nil
    end
  end

  defp artiment_url(%{artiment: %Comment{}}), do: nil

  defp artiment_url(%{artiment: article}) do
    with {:ok, thread} <- FrontDesk.thread_of(article) do
      article_url(thread, article.id)
    else
      _ -> nil
    end
  end

  defp article_url(thread, id), do: "#{get_config(:general, :site_host)}/#{thread}/#{id}"

  defp community_id(%{artiment: %Comment{}, parent_article: article}) when is_map(article),
    do: Map.get(article, :community_id)

  defp community_id(%{artiment: %Comment{}}), do: nil
  defp community_id(%{artiment: %{community_id: community_id}}), do: community_id
  defp community_id(_), do: nil

  defp snapshot(context, mention \\ %{})

  defp snapshot(%{artiment: nil}, %{mentioned_scope: :external, mentioned_url: url}),
    do: %{url: url}

  defp snapshot(%{artiment: nil}, _), do: %{}

  defp snapshot(%{artiment: %Comment{} = comment} = context, _mention) do
    article = Map.get(context, :parent_article)

    %{
      id: comment.id,
      type: :comment,
      title: article && Map.get(article, :title),
      digest: comment.body_html || comment.body,
      url: artiment_url(context)
    }
  end

  defp snapshot(%{artiment: %{login: login} = user}, _mention) do
    %{
      id: user.id,
      type: :user,
      login: login,
      nickname: Map.get(user, :nickname),
      avatar: Map.get(user, :avatar)
    }
  end

  defp snapshot(%{artiment: article} = context, _mention) do
    %{
      id: article.id,
      type: article_type(article),
      title: Map.get(article, :title),
      digest: Map.get(article, :digest),
      url: artiment_url(context)
    }
  end

  defp article_type(article) do
    case FrontDesk.thread_of(article) do
      {:ok, thread} -> thread
      _ -> nil
    end
  end

  defp mentioning_itself?(%Comment{id: id}, %{mentioned_type: :comment, mentioned_id: id}),
    do: true

  defp mentioning_itself?(%Comment{} = comment, %{mentioned_type: :user, mentioned_id: user_id}),
    do: comment.author_id == user_id

  defp mentioning_itself?(article, %{mentioned_type: :user, mentioned_id: user_id}) do
    case FrontDesk.author_of(article) do
      {:ok, %{id: ^user_id}} -> true
      _ -> false
    end
  end

  defp mentioning_itself?(article, %{mentioned_type: mentioned_type, mentioned_id: id})
       when mentioned_type in @threads do
    case FrontDesk.thread_of(article) do
      {:ok, ^mentioned_type} -> article.id == id
      _ -> false
    end
  end

  defp mentioning_itself?(_, _), do: false

  defp normalize_type(type) when is_binary(type) do
    normalized = String.downcase(type)
    Enum.find(@mention_types, &(Atom.to_string(&1) == normalized))
  end

  defp normalize_type(type) when type in @mention_types, do: type
  defp normalize_type(_), do: nil
end
