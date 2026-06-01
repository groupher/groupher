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
  alias CMS.{ArtimentMentions.Parser, FrontDesk}
  alias CMS.Model.{ArtimentMention, Comment}
  alias Helper.{ORM, QueryBuilder, T}

  @article_threads get_config(:article, :threads)
  @mention_types @article_threads ++ [:comment, :user, :url]

  @type sync_result :: {:ok, term()} | {:error, term()}

  @spec sync(Comment.t() | map()) :: sync_result()
  def sync(%{body: body} = artiment) when is_binary(body) do
    with {:ok, ast} <- Helper.ContentPipeline.decode(body),
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

  @spec purge(Comment.t() | map()) :: T.domain_res(term())
  def purge(artiment) do
    {type, id} = mentioner_identity(artiment)

    from(m in ArtimentMention,
      where:
        (m.mentioner_type == ^type and m.mentioner_id == ^id) or
          (m.mentioned_scope == :internal and m.mentioned_type == ^type and m.mentioned_id == ^id)
    )
    |> ORM.delete_all(:if_exist)
  end

  @spec mentions(atom(), T.id(), map()) :: T.domain_res(term())
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

  @spec mentioned_by(atom(), T.id(), map()) :: T.domain_res(term())
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
    mentions =
      ast
      |> Parser.parse()
      |> Enum.reject(&mentioning_itself?(artiment, &1))
      |> Enum.map(&shape(artiment, &1))
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

  defp shape(artiment, mention) do
    {mentioner_type, mentioner_id} = mentioner_identity(artiment)
    mentioned_at = artiment.updated_at |> DateTime.truncate(:second)

    %{
      mentioner_type: mentioner_type,
      mentioner_id: mentioner_id,
      mentioner_community_id: community_id(artiment),
      mentioner_url: artiment_url(artiment),
      mentioned_scope: mention.mentioned_scope,
      mentioned_type: mention.mentioned_type,
      mentioned_id: Map.get(mention, :mentioned_id),
      mentioned_community_id: community_id(Map.get(mention, :artiment)),
      mentioned_url: Map.get(mention, :mentioned_url),
      mentioned_url_hash: Map.get(mention, :mentioned_url_hash),
      mention_case: mention.mention_case,
      occurrences: [mention.occurrence],
      mentioner_snapshot: snapshot(artiment),
      mentioned_snapshot: snapshot(Map.get(mention, :artiment), mention),
      meta: %{},
      mentioned_at: mentioned_at
    }
  end

  defp merge_occurrences(mentions) do
    Enum.reduce(mentions, [], fn mention, acc ->
      case Enum.find_index(acc, &(merge_key(&1) == merge_key(mention))) do
        nil ->
          acc ++ [mention]

        index ->
          List.update_at(acc, index, fn existing ->
            Map.update!(existing, :occurrences, &(&1 ++ mention.occurrences))
          end)
      end
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
    case Repo.preload(article, :document) |> get_in([:document, :json]) do
      nil -> {:ok, []}
      json when is_binary(json) -> Helper.ContentPipeline.decode(json)
      _ -> {:error, {:custom, "invalid json body"}}
    end
  end

  defp mentioner_identity(%Comment{id: id}), do: {:comment, id}

  defp mentioner_identity(article) do
    {:ok, thread} = FrontDesk.thread_of(article)
    {thread, article.id}
  end

  defp artiment_url(%Comment{} = comment) do
    with {:ok, article} <- FrontDesk.article_of(comment),
         {:ok, thread} <- FrontDesk.thread_of(article) do
      "#{article_url(thread, article.id)}?comment_id=#{comment.id}"
    else
      _ -> nil
    end
  end

  defp artiment_url(article) do
    with {:ok, thread} <- FrontDesk.thread_of(article) do
      article_url(thread, article.id)
    else
      _ -> nil
    end
  end

  defp article_url(thread, id), do: "#{get_config(:general, :site_host)}/#{thread}/#{id}"

  defp community_id(%Comment{} = comment) do
    case FrontDesk.article_of(comment) do
      {:ok, article} -> Map.get(article, :community_id)
      _ -> nil
    end
  end

  defp community_id(%{community_id: community_id}), do: community_id
  defp community_id(_), do: nil

  defp snapshot(artiment, mention \\ %{})
  defp snapshot(nil, %{mentioned_scope: :external, mentioned_url: url}), do: %{url: url}
  defp snapshot(nil, _), do: %{}

  defp snapshot(%Comment{} = comment, _mention) do
    article =
      case FrontDesk.article_of(comment) do
        {:ok, article} -> article
        _ -> nil
      end

    %{
      id: comment.id,
      type: :comment,
      title: article && Map.get(article, :title),
      digest: comment.body_html || comment.body,
      url: artiment_url(comment)
    }
  end

  defp snapshot(%{login: login} = user, _mention) do
    %{
      id: user.id,
      type: :user,
      login: login,
      nickname: Map.get(user, :nickname),
      avatar: Map.get(user, :avatar)
    }
  end

  defp snapshot(article, _mention) do
    %{
      id: article.id,
      type: article_type(article),
      title: Map.get(article, :title),
      digest: Map.get(article, :digest),
      url: artiment_url(article)
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
       when mentioned_type in @article_threads do
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
