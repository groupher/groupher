defmodule GroupherServer.CMS.Articles.Draft do
  @moduledoc """
  Universal article draft workflow.

  This module owns the staged content lifecycle for every article thread. Docs
  tree code may reference a draft, but it does not own the draft content.

      create/update
          |
          v
      ArticleDraft
          |
          +-- checkpoint --> ArticleRevision(type=draft)
          |
          +-- publish ----> thread article table
                          -> ArticleRevision(type=published)
                          -> clear draft revisions

  Public functions keep examples because callers from docs, posts, and
  changelogs are expected to share this module rather than reimplementing the
  same staged/published state machine.
  """

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.Write
  alias CMS.Model.{ArticleDraft, Author, Community}
  alias Helper.{ArticlePayload, ContentPipeline, ORM, T, Transaction}
  alias Helper.Validator.Slug
  import Helper.Utils, only: [get_config: 2]

  @digest_length get_config(:article, :digest_length)

  @doc """
  Reads one draft with its community scope.

  ## Examples

      iex> Draft.read(community, draft.id)
      {:ok, %ArticleDraft{}}
  """
  @spec read(Community.t(), T.id()) :: T.domain_res(ArticleDraft.t())
  def read(%Community{} = community, id) do
    ArticleDraft
    |> ORM.find_by(id: id, community_id: community.id)
  end

  @doc """
  Creates a new draft from raw editor body.

  ## Examples

      iex> Draft.create(community, :post, %{title: "Hello", slug: "hello", body: "[...]"}, user)
      {:ok, %ArticleDraft{thread: :post}}
  """
  @spec create(Community.t(), T.article_thread(), map(), User.t()) ::
          T.domain_res(ArticleDraft.t())
  def create(%Community{} = community, thread, attrs, %User{} = user) do
    with {:ok, %Author{} = author} <- Write.ensure_author_exists(user) do
      create_with_author(community, thread, attrs, author)
    end
  end

  @doc """
  Creates a draft when the caller already resolved the CMS author.

  Template/bootstrap code often creates several drafts for the same user. Passing
  the resolved author avoids repeatedly doing user-to-author lookup while still
  going through the same article payload path as `create/4`.

  ## Examples

      iex> Draft.create_with_author(community, :doc, attrs, author)
      {:ok, %ArticleDraft{author_id: author.id}}
  """
  @spec create_with_author(Community.t(), T.article_thread(), map(), Author.t()) ::
          T.domain_res(ArticleDraft.t())
  def create_with_author(%Community{} = community, thread, attrs, %Author{} = author) do
    with {:ok, payload} <- parse_body(attrs),
         {:ok, draft_attrs} <- build_attrs(community, thread, attrs, payload, author) do
      ORM.create(ArticleDraft, draft_attrs)
    end
  end

  @doc """
  Updates staged content and derived document fields.

  The body is parsed through `ContentPipeline` so `json`, `html`, `rss`, digest,
  and `content_hash` stay in sync.

  ## Examples

      iex> Draft.update(community, draft.id, %{title: "Next", slug: "next", body: "[...]"})
      {:ok, %ArticleDraft{title: "Next"}}
  """
  @spec update(Community.t(), T.id(), map()) :: T.domain_res(ArticleDraft.t())
  def update(%Community{} = community, id, attrs) do
    Transaction.lock_global(lock_key(community, id), fn ->
      update_unlocked(community, id, attrs)
    end)
  end

  @doc """
  Updates a draft when the caller already holds `lock_key/2`.

  Use this only inside higher-level workflows that must update the draft and its
  revisions under one critical section.

  ## Examples

      iex> Transaction.lock_global(Draft.lock_key(community, draft.id), fn ->
      ...>   Draft.update_unlocked(community, draft.id, attrs)
      ...> end)
      {:ok, %ArticleDraft{}}
  """
  @spec update_unlocked(Community.t(), T.id(), map()) :: T.domain_res(ArticleDraft.t())
  def update_unlocked(%Community{} = community, id, attrs) do
    with {:ok, draft} <- read(community, id),
         {:ok, payload} <- maybe_parse_body(attrs),
         {:ok, draft_attrs} <- update_attrs(draft, attrs, payload),
         {:ok, draft} <- maybe_update_draft(draft, draft_attrs) do
      {:ok, draft}
    end
  end

  @doc """
  Publishes a draft into its thread article table.

  A new published article is created when `article_id` is empty. Otherwise the
  existing article is updated. The returned article is suitable for creating a
  `type: :published` revision.

  ## Examples

      iex> Draft.publish(community, draft.id, user)
      {:ok, %{id: article_id}}
  """
  @spec publish(Community.t(), T.id(), User.t()) :: T.domain_res(T.article())
  def publish(%Community{} = community, id, %User{} = user) do
    Transaction.lock_global(lock_key(community, id), fn ->
      publish_unlocked(community, id, user)
    end)
  end

  @doc """
  Publishes a draft when the caller already holds `lock_key/2`.

  ## Examples

      iex> Transaction.lock_global(Draft.lock_key(community, draft.id), fn ->
      ...>   Draft.publish_unlocked(community, draft.id, user)
      ...> end)
      {:ok, article}
  """
  @spec publish_unlocked(Community.t(), T.id(), User.t()) :: T.domain_res(T.article())
  def publish_unlocked(%Community{} = community, id, %User{} = user) do
    with {:ok, draft} <- read(community, id),
         :ok <- validate_slug(draft.slug),
         {:ok, article} <- upsert_article(community, draft, user),
         {:ok, _draft} <- link_article(draft, article) do
      {:ok, article}
    end
  end

  @doc """
  Advisory lock key shared by autosave, publish, checkpoint, and restore.

  ## Examples

      iex> Draft.lock_key(community, 123)
      "article_draft:1:123"
  """
  @spec lock_key(Community.t(), T.id()) :: String.t()
  def lock_key(%Community{} = community, id), do: "article_draft:#{community.id}:#{id}"

  defp parse_body(%{body: body}) when is_binary(body), do: ContentPipeline.parse(%{body: body})
  defp parse_body(_attrs), do: {:error, {:custom, "article draft body is required"}}

  defp maybe_parse_body(%{body: body}) when is_binary(body),
    do: ContentPipeline.parse(%{body: body})

  defp maybe_parse_body(_attrs), do: {:ok, nil}

  defp build_attrs(%Community{} = community, thread, attrs, payload, %Author{} = author) do
    attrs =
      payload
      |> ArticlePayload.pick_valid_fields()
      |> Map.merge(%{
        community_id: community.id,
        thread: thread,
        author_id: author.id,
        title: Map.get(attrs, :title),
        subtitle: normalize_subtitle(Map.get(attrs, :subtitle)),
        slug: Map.get(attrs, :slug),
        digest: resolve_digest(Map.get(attrs, :subtitle), fallback_digest(nil, payload)),
        template_key: Map.get(attrs, :template_key)
      })
      |> maybe_put_article_id(Map.get(attrs, :article_id))

    {:ok, attrs}
  end

  defp update_attrs(draft, %{title: _title} = attrs, payload) do
    if is_binary(Map.get(attrs, :slug)) do
      do_update_attrs(draft, attrs, payload)
    else
      {:error, {:custom, "article draft slug is required"}}
    end
  end

  defp update_attrs(draft, attrs, payload), do: do_update_attrs(draft, attrs, payload)

  defp do_update_attrs(%ArticleDraft{} = draft, attrs, payload) do
    subtitle = next_subtitle(draft, attrs)
    fallback_digest = fallback_digest(draft, payload)

    attrs
    |> Map.take([:title, :slug, :subtitle])
    |> normalize_subtitle_attr()
    |> maybe_put_payload(payload)
    |> maybe_put_digest(attrs, payload, subtitle, fallback_digest)
    |> then(&{:ok, &1})
  end

  defp maybe_put_payload(attrs, nil), do: attrs

  defp maybe_put_payload(attrs, payload) do
    Map.merge(attrs, ArticlePayload.pick_valid_fields(payload))
  end

  defp next_subtitle(%ArticleDraft{} = draft, attrs) do
    if Map.has_key?(attrs, :subtitle), do: Map.get(attrs, :subtitle), else: draft.subtitle
  end

  defp normalize_subtitle_attr(attrs) do
    if Map.has_key?(attrs, :subtitle) do
      Map.put(attrs, :subtitle, normalize_subtitle(Map.get(attrs, :subtitle)))
    else
      attrs
    end
  end

  defp normalize_subtitle(value) when is_binary(value) do
    value
    |> String.trim()
    |> case do
      "" -> nil
      subtitle -> subtitle
    end
  end

  defp normalize_subtitle(_), do: nil

  defp maybe_put_digest(attrs, input_attrs, payload, subtitle, fallback_digest) do
    if payload || Map.has_key?(input_attrs, :subtitle) do
      Map.put(attrs, :digest, resolve_digest(subtitle, fallback_digest))
    else
      attrs
    end
  end

  defp resolve_digest(subtitle, fallback_digest) do
    case normalize_subtitle(subtitle) do
      nil -> fallback_digest
      subtitle -> String.slice(subtitle, 0, 400)
    end
  end

  defp fallback_digest(_draft, %{plain_text: plain_text}) when is_binary(plain_text),
    do: first_sentence_digest(plain_text)

  defp fallback_digest(%ArticleDraft{plain_text: plain_text}, _payload)
       when is_binary(plain_text),
       do: first_sentence_digest(plain_text)

  defp fallback_digest(%ArticleDraft{digest: digest}, _payload) when is_binary(digest), do: digest

  defp first_sentence_digest(plain_text) do
    text = String.trim(plain_text)

    case Regex.run(~r/^.*?[.!?。！？]/u, text) do
      [sentence] -> String.slice(sentence, 0, @digest_length)
      _ -> String.slice(text, 0, @digest_length)
    end
  end

  defp maybe_update_draft(draft, attrs) when map_size(attrs) == 0, do: {:ok, draft}
  defp maybe_update_draft(draft, attrs), do: ORM.update(draft, attrs)

  defp validate_slug(slug) do
    if Slug.valid?(slug), do: :ok, else: {:error, {:custom, "article draft slug is invalid"}}
  end

  defp upsert_article(
         %Community{} = community,
         %ArticleDraft{article_id: nil} = draft,
         %User{} = user
       ) do
    Write.create(community, draft.thread, publish_attrs(draft), user)
  end

  defp upsert_article(_community, %ArticleDraft{article_id: article_id} = draft, _user) do
    with {:ok, article} <- published_article(draft.thread, article_id) do
      Write.update(article, publish_attrs(draft))
    end
  end

  defp published_article(thread, article_id) do
    CMS.Model
    |> Module.concat(Recase.to_pascal(to_string(thread)))
    |> ORM.find(article_id)
  end

  defp publish_attrs(%ArticleDraft{} = draft) do
    %{
      title: draft.title,
      subtitle: draft.subtitle,
      slug: draft.slug,
      digest: draft.digest,
      body: draft.json,
      community_tags: []
    }
  end

  defp link_article(%ArticleDraft{article_id: article_id} = draft, %{id: article_id})
       when not is_nil(article_id) do
    {:ok, draft}
  end

  defp link_article(%ArticleDraft{} = draft, %{id: article_id}) do
    ORM.update(draft, %{article_id: article_id})
  end

  defp maybe_put_article_id(attrs, nil), do: attrs
  defp maybe_put_article_id(attrs, article_id), do: Map.put(attrs, :article_id, article_id)
end
