defmodule GroupherServer.CMS.Articles.Draft do
  @moduledoc """
  Universal doc draft/snapshot workflow.

  This module owns the staged content lifecycle for every thread. Docs
  tree code may reference a draft, but it does not own the draft content.

      create/update
          |
          v
      Doc(stage=draft)
          |
          +-- checkpoint --> ArticleSnapshot(stage=draft)
          |
          +-- publish ----> Doc(stage=public)
                          -> ArticleSnapshot(stage=public)
                          -> clear draft checkpoints

  Public functions keep examples because callers from docs, posts, and
  changelogs are expected to share this module rather than reimplementing the
  same staged/published state machine.
  """

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.Document
  alias CMS.Model.{Doc, Author, Community}
  alias Helper.{ArticlePayload, ContentPipeline, ORM, T, Transaction}
  alias Helper.Validator.Slug
  import Helper.Utils, only: [get_config: 2]

  require CMS.Const

  @digest_length get_config(:article, :digest_length)

  @doc """
  Reads one draft with its community scope.

  ## Examples

      iex> Draft.read(community, draft.doc_id)
      {:ok, %Doc{}}
  """
  @spec read(Community.t(), String.t()) :: T.domain_res(Doc.t())
  def read(%Community{} = community, doc_id) do
    Doc
    |> ORM.find_by(doc_id: doc_id, community_id: community.id, stage: CMS.Const.stage(:draft))
  end

  @doc """
  Reads the document currently shown in the dashboard editor.

  The editor can be opened after a successful publish, when the draft row has
  already been promoted to or merged into the public row. Loading must therefore
  prefer draft content but fall back to public content instead of treating a
  missing draft as an editor failure.
  """
  @spec read_editor(Community.t(), String.t()) :: T.domain_res(Doc.t())
  def read_editor(%Community{} = community, doc_id) do
    case read(community, doc_id) do
      {:ok, draft} -> {:ok, draft}
      {:error, _} -> read_public(community, doc_id)
    end
  end

  @doc """
  Creates a new draft from raw editor body.

  ## Examples

      iex> Draft.create(community, :post, %{title: "Hello", slug: "hello", body: "[...]"}, user)
      {:ok, %Doc{thread: :post}}
  """
  @spec create(Community.t(), T.thread(), map(), User.t()) ::
          T.domain_res(Doc.t())
  def create(%Community{} = community, thread, attrs, %User{} = user) do
    with {:ok, %Author{} = author} <- CMS.Articles.Write.ensure_author_exists(user) do
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
      {:ok, %Doc{author_id: author.id}}
  """
  @spec create_with_author(Community.t(), T.thread(), map(), Author.t()) ::
          T.domain_res(Doc.t())
  def create_with_author(%Community{} = community, thread, attrs, %Author{} = author) do
    with {:ok, payload} <- parse_body(attrs),
         {:ok, draft_attrs} <- build_attrs(community, thread, attrs, payload, author) do
      Repo.transaction(fn ->
        with {:ok, draft} <- ORM.create(Doc, draft_attrs),
             {:ok, _} <- Document.create_doc(draft, %{article_payload: payload}) do
          draft
        else
          {:error, reason} -> Repo.rollback(reason)
          reason -> Repo.rollback(reason)
        end
      end)
    end
  end

  @doc """
  Updates staged content and derived document fields.

  The body is parsed through `ContentPipeline` so `json`, `html`, `rss`, digest,
  and `content_hash` stay in sync.

  ## Examples

      iex> Draft.update(community, draft.doc_id, %{title: "Next", slug: "next", body: "[...]"})
      {:ok, %Doc{title: "Next"}}
  """
  @spec update(Community.t(), String.t(), map()) :: T.domain_res(Doc.t())
  def update(%Community{} = community, doc_id, attrs) do
    Transaction.lock_global(lock_key(community, doc_id), fn ->
      update_unlocked(community, doc_id, attrs)
    end)
  end

  @doc """
  Updates the editable draft, creating it from the public row when needed.

  This supports the editor flow where a public doc becomes draft-backed on the
  first real edit. The caller passes the current editor payload; after the draft
  row is ensured, the same attrs are saved into that draft.
  """
  @spec update_or_create_from_public(Community.t(), String.t(), map(), User.t()) ::
          T.domain_res(Doc.t())
  def update_or_create_from_public(
        %Community{} = community,
        doc_id,
        attrs,
        %User{} = user
      ) do
    Transaction.lock_global(lock_key(community, doc_id), fn ->
      with {:ok, _draft} <- ensure_from_public_unlocked(community, doc_id, user) do
        update_unlocked(community, doc_id, attrs)
      end
    end)
  end

  @doc """
  Updates a draft when the caller already holds `lock_key/2`.

  Use this only inside higher-level workflows that must update the draft and its
  snapshots under one critical section.

  ## Examples

      iex> Transaction.lock_global(Draft.lock_key(community, draft.doc_id), fn ->
      ...>   Draft.update_unlocked(community, draft.doc_id, attrs)
      ...> end)
      {:ok, %Doc{}}
  """
  @spec update_unlocked(Community.t(), String.t(), map()) :: T.domain_res(Doc.t())
  def update_unlocked(%Community{} = community, doc_id, attrs) do
    with {:ok, draft} <- read(community, doc_id),
         {:ok, payload} <- maybe_parse_body(attrs),
         {:ok, draft_attrs} <- update_attrs(draft, attrs, payload),
         {:ok, draft} <- maybe_update_draft(draft, draft_attrs),
         {:ok, _} <- maybe_update_document(draft, payload) do
      {:ok, draft}
    end
  end

  @doc """
  Publishes a draft into a public Doc.

  First-time publish updates the draft stage to `:public`. When a public Doc
  already exists with the same `doc_id`, the public row is updated from the
  draft content and the draft row is removed.

  ## Examples

      iex> Draft.publish(community, draft.doc_id, user)
      {:ok, %Doc{stage: CMS.Const.stage(:public)}}
  """
  @spec publish(Community.t(), String.t(), User.t()) :: T.domain_res(Doc.t())
  def publish(%Community{} = community, doc_id, %User{} = user) do
    Transaction.lock_global(lock_key(community, doc_id), fn ->
      publish_unlocked(community, doc_id, user)
    end)
  end

  @doc """
  Publishes a draft when the caller already holds `lock_key/2`.

  ## Examples

      iex> Transaction.lock_global(Draft.lock_key(community, draft.doc_id), fn ->
      ...>   Draft.publish_unlocked(community, draft.doc_id, user)
      ...> end)
      {:ok, %Doc{stage: CMS.Const.stage(:public)}}
  """
  @spec publish_unlocked(Community.t(), String.t(), User.t()) :: T.domain_res(Doc.t())
  def publish_unlocked(%Community{} = community, doc_id, %User{} = _user) do
    with {:ok, draft} <- read(community, doc_id),
         :ok <- validate_slug(draft.slug),
         {:ok, public_doc} <- do_publish(community, draft) do
      {:ok, public_doc}
    end
  end

  @doc """
  Advisory lock key shared by autosave, publish, checkpoint, and restore.

  ## Examples

      iex> Draft.lock_key(community, "abc-123")
      "doc_draft:1:abc-123"
  """
  @spec lock_key(Community.t(), String.t()) :: String.t()
  def lock_key(%Community{} = community, doc_id), do: "doc_draft:#{community.id}:#{doc_id}"

  defp parse_body(%{body: body}) when is_binary(body), do: ContentPipeline.parse(%{body: body})
  defp parse_body(_attrs), do: {:error, {:custom, "article version body is required"}}

  defp maybe_parse_body(%{body: body}) when is_binary(body),
    do: ContentPipeline.parse(%{body: body})

  defp maybe_parse_body(_attrs), do: {:ok, nil}

  defp build_attrs(%Community{} = community, _thread, attrs, payload, %Author{} = author) do
    attrs =
      payload
      |> ArticlePayload.pick_valid_fields()
      |> Map.merge(%{
        community_id: community.id,
        stage: CMS.Const.stage(:draft),
        author_id: author.id,
        doc_id: Map.get(attrs, :doc_id) || Ecto.UUID.generate(),
        title: Map.get(attrs, :title),
        subtitle: normalize_subtitle(Map.get(attrs, :subtitle)),
        slug: Map.get(attrs, :slug),
        digest: resolve_digest(Map.get(attrs, :subtitle), fallback_digest(nil, payload)),
        template_key: Map.get(attrs, :template_key)
      })

    {:ok, attrs}
  end

  defp update_attrs(draft, %{title: _title} = attrs, payload) do
    if is_binary(Map.get(attrs, :slug)) do
      do_update_attrs(draft, attrs, payload)
    else
      {:error, {:custom, "article version slug is required"}}
    end
  end

  defp update_attrs(draft, attrs, payload), do: do_update_attrs(draft, attrs, payload)

  defp do_update_attrs(%Doc{} = draft, attrs, payload) do
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

  defp next_subtitle(%Doc{} = draft, attrs) do
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

  defp fallback_digest(%Doc{digest: digest}, _payload) when is_binary(digest),
    do: digest

  defp fallback_digest(_draft, _payload), do: nil

  defp first_sentence_digest(plain_text) do
    text = String.trim(plain_text)

    case Regex.run(~r/^.*?[.!?。！？]/u, text) do
      [sentence] -> String.slice(sentence, 0, @digest_length)
      _ -> String.slice(text, 0, @digest_length)
    end
  end

  defp maybe_update_draft(draft, attrs) when map_size(attrs) == 0, do: {:ok, draft}
  defp maybe_update_draft(draft, attrs), do: ORM.update(draft, attrs)

  defp maybe_update_document(_draft, nil), do: {:ok, nil}

  defp maybe_update_document(draft, payload),
    do: Document.update_doc(draft, %{article_payload: payload})

  defp validate_slug(slug) do
    if Slug.valid?(slug), do: :ok, else: {:error, {:custom, "article version slug is invalid"}}
  end

  defp read_public(%Community{} = community, doc_id) do
    Doc
    |> ORM.find_by(doc_id: doc_id, community_id: community.id, stage: CMS.Const.stage(:public))
  end

  defp ensure_from_public_unlocked(%Community{} = community, doc_id, %User{} = user) do
    case read(community, doc_id) do
      {:ok, draft} ->
        {:ok, draft}

      {:error, _} ->
        with {:ok, public_doc} <- read_public(community, doc_id) do
          create(community, :doc, draft_attrs_from_public(public_doc), user)
        end
    end
  end

  defp draft_attrs_from_public(%Doc{} = public_doc) do
    %{
      doc_id: public_doc.doc_id,
      title: public_doc.title,
      subtitle: public_doc.subtitle,
      slug: public_doc.slug,
      body: public_doc.json,
      template_key: Map.get(public_doc, :template_key)
    }
  end

  defp do_publish(%Community{} = community, %Doc{stage: CMS.Const.stage(:draft)} = draft) do
    case ORM.find_by(Doc,
           doc_id: draft.doc_id,
           community_id: community.id,
           stage: CMS.Const.stage(:public)
         ) do
      {:ok, public_doc} ->
        with {:ok, public_doc} <- ORM.update(public_doc, publish_content_attrs(draft)),
             {:ok, _document} <- Document.update_doc(public_doc, document_attrs_from_doc(draft)),
             {:ok, _draft} <- ORM.delete(draft) do
          {:ok, public_doc}
        end

      {:error, _} ->
        ORM.update(draft, %{stage: CMS.Const.stage(:public)})
    end
  end

  defp publish_content_attrs(%Doc{} = draft) do
    %{
      title: draft.title,
      subtitle: draft.subtitle,
      slug: draft.slug,
      digest: draft.digest,
      json: draft.json,
      content_hash: draft.content_hash,
      schema_version: draft.schema_version
    }
  end

  defp document_attrs_from_doc(%Doc{} = doc) do
    %{article_payload: doc, title: doc.title}
  end
end
