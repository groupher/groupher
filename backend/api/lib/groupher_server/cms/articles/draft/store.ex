defmodule GroupherServer.CMS.Articles.Draft.Store do
  @moduledoc """
  Owns persistence for mutable Draft workspaces behind the Articles facade.

      CMS.Articles command -> stable Article lock -> Draft Store -> Draft tables
                                                      |
                                                      `-> body / tags / typed fields

  It never advances a Public head or creates a Revision.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Artiment.BodyBag
  alias CMS.CanonicalJSON
  alias CMS.Articles.ContentFingerprint

  alias CMS.Model.{
    Article,
    ArticleBodyDraft,
    ArticleBodySnapshot,
    ArticleCommunity,
    ArticleDraft,
    ArticlePublic,
    ArticleRevision,
    Author,
    BlogDraft,
    BlogRevision,
    ChangelogDraft,
    ChangelogRevision,
    Community,
    CoverBackground,
    DraftCoverEdit,
    DocDraft,
    DocBranchState,
    DocRevision,
    DocLifecycle,
    PostDraft,
    PostState,
    PostRevision
  }

  alias CMS.Model.ArticleLifecycle

  @typed_models %{
    post: {PostDraft, PostRevision},
    blog: {BlogDraft, BlogRevision},
    changelog: {ChangelogDraft, ChangelogRevision}
  }
  @shared_fields ~w(title digest slug)a
  @ordinary_typed_fields ~w(copy_right link_addr cover_url cover_url_dark)a
  @doc_fields ~w(subtitle link_addr template_key cover_url cover_url_dark)a
  @doc_draft_fields ~w(subtitle link_addr template_key)a

  @doc "Creates a stable Article and its first mutable Draft without creating a Revision."
  @spec create(Community.t(), atom(), map(), Author.t(), keyword()) ::
          {:ok, %{article: Article.t(), draft: ArticleDraft.t() | DocDraft.t()}}
          | {:error, term()}
  def create(%Community{} = community, thread, attrs, %Author{} = author, opts \\ []) do
    Repo.transaction(fn ->
      with :ok <- validate_cover(attrs),
           {:ok, body_bag} <- cast_body(attrs, thread),
           {:ok, article} <- insert_article(community, thread, author, attrs),
           {:ok, _community_relation} <- insert_home_community(article),
           {:ok, _lifecycle} <- insert_lifecycle(article, opts),
           {:ok, _branch_state} <- insert_branch_state(article, opts),
           {:ok, _post_state} <- insert_post_state(article, attrs),
           {:ok, body_draft} <- insert_body(body_bag),
           :ok <- save_cover_edit(body_draft.id, attrs),
           {:ok, draft} <- insert_draft(article, body_draft, author, attrs, opts),
           {:ok, _typed} <- insert_typed_draft(article, draft, attrs),
           :ok <- replace_tags(article, draft, tag_ids(attrs)) do
        %{article: article, draft: draft}
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Loads the current ordinary or branch-scoped Draft for a stable Article."
  @spec get(Article.t(), keyword()) ::
          {:ok, ArticleDraft.t() | DocDraft.t()} | {:error, :not_found}
  def get(%Article{thread: thread, id: article_id}, opts \\ []) do
    result =
      if thread == :doc do
        Repo.get_by(DocDraft, article_id: article_id, branch_id: Keyword.fetch!(opts, :branch_id))
      else
        Repo.get(ArticleDraft, article_id)
      end

    if result, do: {:ok, result}, else: {:error, :not_found}
  end

  @doc "Applies an optimistic autosave to Draft, body, typed fields, and tags in one transaction."
  @spec update(Article.t(), map(), Author.t(), keyword()) ::
          {:ok, ArticleDraft.t() | DocDraft.t()} | {:error, term()}
  def update(%Article{} = article, attrs, %Author{} = author, opts \\ []) do
    expected_version = Keyword.fetch!(opts, :expected_version)

    Repo.transaction(fn ->
      with :ok <- validate_cover(attrs),
           {:ok, draft} <- lock_draft(article, opts),
           :ok <- ensure_version(draft, expected_version),
           {:ok, body_draft} <- update_body(draft, attrs, article.thread),
           attrs <- maybe_put_body_digest(article, attrs, body_draft),
           :ok <- save_cover_edit(body_draft.id, attrs),
           content_hash <- content_hash(article, attrs, body_draft, draft),
           {:ok, draft} <- update_draft_row(draft, attrs, author, content_hash),
           {:ok, _typed} <- update_typed_draft(article, draft, attrs),
           :ok <- maybe_replace_tags(article, draft, attrs),
           {:ok, _article} <- mark_edited_if_published(article, opts) do
        draft
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp maybe_put_body_digest(%Article{thread: :doc}, attrs, body) do
    if Map.has_key?(attrs, :body_bag) and not Map.has_key?(attrs, :digest) and
         not Map.has_key?(attrs, :subtitle) do
      Map.put(attrs, :digest, body.plain_text)
    else
      attrs
    end
  end

  defp maybe_put_body_digest(_article, attrs, _body), do: attrs

  @doc "Copies the current Public Revision into a new mutable Draft when editing begins."
  @spec ensure_from_public(Article.t(), Author.t(), keyword()) ::
          {:ok, ArticleDraft.t() | DocDraft.t()} | {:error, term()}
  def ensure_from_public(%Article{} = article, %Author{} = author, opts \\ []) do
    case get(article, opts) do
      {:ok, draft} ->
        {:ok, draft}

      {:error, :not_found} ->
        Repo.transaction(fn ->
          with {:ok, public, revision} <- public_revision(article, opts),
               {:ok, body} <- snapshot_to_draft(revision),
               {:ok, extension} <- revision_extension(article.thread, revision),
               attrs <- revision_attrs(revision, extension),
               {:ok, draft} <-
                 insert_draft(
                   article,
                   body,
                   author,
                   attrs,
                   opts
                   |> Keyword.put(:base_revision_id, public_revision_id(public, revision))
                   |> Keyword.put(:version, public.publication_version)
                 ),
               {:ok, _typed} <- insert_typed_draft(article, draft, attrs),
               :ok <- copy_revision_cover_edit(revision.id, body.id),
               {:ok, draft} <- set_content_hash(draft, revision.content_hash),
               :ok <- copy_revision_tags(article, draft, revision) do
            draft
          else
            {:error, reason} -> Repo.rollback(reason)
          end
        end)
    end
  end

  @doc "Replaces a Doc workspace with mutable content copied from one immutable Revision."
  @spec restore_from_revision(Article.t(), ArticleRevision.t(), Author.t(), keyword()) ::
          {:ok, DocDraft.t()} | {:error, term()}
  def restore_from_revision(
        %Article{thread: :doc} = article,
        %ArticleRevision{article_id: article_id} = revision,
        %Author{} = author,
        opts
      )
      when article_id == article.id do
    Repo.transaction(fn ->
      with :ok <- discard_existing_workspace(article, opts),
           {:ok, body} <- snapshot_to_draft(revision),
           {:ok, extension} <- revision_extension(:doc, revision),
           attrs <- revision_attrs(revision, extension),
           {:ok, draft} <-
             insert_draft(
               article,
               body,
               author,
               attrs,
               opts
               |> Keyword.put(:base_revision_id, Keyword.get(opts, :base_revision_id))
               |> Keyword.put(:source_revision_id, revision.id)
             ),
           {:ok, _typed} <- insert_typed_draft(article, draft, attrs),
           :ok <- copy_revision_cover_edit(revision.id, body.id),
           {:ok, draft} <- set_content_hash(draft, revision.content_hash),
           :ok <- copy_revision_tags(article, draft, revision) do
        draft
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  def restore_from_revision(%Article{}, %ArticleRevision{}, %Author{}, _opts),
    do: {:error, :revision_owner_mismatch}

  @doc "Deletes only the mutable workspace while preserving the current Public head."
  @spec discard(Article.t(), keyword()) :: :ok | {:error, term()}
  def discard(%Article{} = article, opts \\ []) do
    expected_version = Keyword.fetch!(opts, :expected_version)

    result =
      Repo.transaction(fn ->
        with {:ok, _public, _revision} <- public_revision(article, opts),
             {:ok, draft} <- lock_draft(article, opts),
             :ok <- ensure_version(draft, expected_version),
             :ok <- delete_workspace(article, draft) do
          :ok
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)

    case result do
      {:ok, :ok} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Removes a known Draft aggregate after Publish has selected its immutable Revision."
  @spec delete_workspace(Article.t(), ArticleDraft.t() | DocDraft.t()) :: :ok | {:error, term()}
  def delete_workspace(%Article{} = article, draft) do
    with :ok <- delete_tags(article, draft),
         :ok <- delete_typed_draft(article, draft),
         {:ok, _draft} <- Repo.delete(draft),
         %ArticleBodyDraft{} = body <- Repo.get(ArticleBodyDraft, draft.body_draft_id),
         {:ok, _body} <- Repo.delete(body) do
      :ok
    else
      nil -> {:error, :body_draft_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp insert_article(community, thread, author, attrs) do
    %Article{id: value(attrs, :article_id)}
    |> Article.changeset(%{
      community_id: community.id,
      thread: thread,
      author_id: author.id,
      moderation_state: Map.get(attrs, :moderation_state, :legal)
    })
    |> Repo.insert()
  end

  defp insert_post_state(%Article{thread: :post, id: article_id}, attrs) do
    %PostState{}
    |> PostState.changeset(%{
      article_id: article_id,
      cat: value(attrs, :cat),
      status: value(attrs, :status)
    })
    |> Repo.insert()
  end

  defp insert_post_state(%Article{}, _attrs), do: {:ok, nil}

  defp cast_body(attrs, thread) do
    body = Map.get(attrs, :body_bag) || Map.get(attrs, "body_bag")
    body = body || if(thread == :doc, do: BodyBag.empty_doc(), else: %{})
    BodyBag.cast(body, thread: thread)
  end

  defp insert_body(body_bag) do
    attrs = BodyBag.to_document_attrs(body_bag)

    %ArticleBodyDraft{}
    |> ArticleBodyDraft.changeset(attrs)
    |> Repo.insert()
  end

  defp insert_draft(%Article{thread: :doc} = article, body, author, attrs, opts) do
    attrs =
      attrs
      |> take(@shared_fields ++ @doc_fields)
      |> Map.merge(%{
        article_id: article.id,
        branch_id: Keyword.fetch!(opts, :branch_id),
        base_revision_id: Keyword.get(opts, :base_revision_id),
        source_revision_id: Keyword.get(opts, :source_revision_id),
        body_draft_id: body.id,
        version: Keyword.get(opts, :version, 1),
        updated_by_id: author.id,
        digest:
          first_present([
            value(attrs, :digest),
            value(attrs, :subtitle),
            value(attrs, :title),
            body.plain_text,
            "untitled"
          ]),
        content_hash: content_hash(article, attrs, body, nil)
      })

    %DocDraft{} |> DocDraft.changeset(attrs) |> Repo.insert()
  end

  defp insert_draft(%Article{} = article, body, author, attrs, opts) do
    attrs =
      attrs
      |> take(@shared_fields)
      |> Map.merge(%{
        article_id: article.id,
        base_revision_id: Keyword.get(opts, :base_revision_id),
        body_draft_id: body.id,
        version: Keyword.get(opts, :version, 1),
        updated_by_id: author.id,
        digest:
          first_present([
            value(attrs, :digest),
            body.plain_text,
            value(attrs, :title),
            "untitled"
          ]),
        content_hash: content_hash(article, attrs, body, nil)
      })

    %ArticleDraft{} |> ArticleDraft.changeset(attrs) |> Repo.insert()
  end

  defp insert_typed_draft(%Article{thread: :doc}, %DocDraft{} = draft, _attrs), do: {:ok, draft}

  defp insert_typed_draft(%Article{thread: thread}, draft, attrs) do
    {model, _revision_model} = Map.fetch!(@typed_models, thread)

    model
    |> struct()
    |> model.changeset(
      Map.put(take(attrs, @ordinary_typed_fields), :article_id, draft.article_id)
    )
    |> Repo.insert()
  end

  defp first_present(values),
    do: Enum.find(values, &(is_binary(&1) and String.trim(&1) != ""))

  defp lock_draft(%Article{thread: :doc, id: article_id}, opts) do
    DocDraft
    |> where(
      [draft],
      draft.article_id == ^article_id and draft.branch_id == ^Keyword.fetch!(opts, :branch_id)
    )
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> present()
  end

  defp lock_draft(%Article{id: article_id}, _opts) do
    ArticleDraft
    |> where([draft], draft.article_id == ^article_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> present()
  end

  defp present(nil), do: {:error, :draft_not_found}
  defp present(value), do: {:ok, value}
  defp ensure_version(%{version: version}, version), do: :ok
  defp ensure_version(_draft, _expected), do: {:error, :draft_version_conflict}

  defp update_body(draft, attrs, thread) do
    case value(attrs, :body_bag) do
      nil ->
        present(Repo.get(ArticleBodyDraft, draft.body_draft_id))

      input ->
        with {:ok, body_bag} <- BodyBag.cast(input, thread: thread),
             %ArticleBodyDraft{} = body <- Repo.get(ArticleBodyDraft, draft.body_draft_id) do
          body |> ArticleBodyDraft.changeset(BodyBag.to_document_attrs(body_bag)) |> Repo.update()
        else
          nil -> {:error, :body_draft_not_found}
          error -> error
        end
    end
  end

  defp update_draft_row(draft, attrs, author, content_hash) do
    fields =
      if match?(%DocDraft{}, draft),
        do: @shared_fields ++ @doc_draft_fields,
        else: @shared_fields

    draft
    |> Ecto.Changeset.cast(take(attrs, fields), fields)
    |> Ecto.Changeset.change(%{
      version: draft.version + 1,
      updated_by_id: author.id,
      content_hash: content_hash
    })
    |> Repo.update()
  end

  defp update_typed_draft(%Article{thread: :doc}, draft, _attrs), do: {:ok, draft}

  defp update_typed_draft(%Article{thread: thread}, draft, attrs) do
    {model, _revision_model} = Map.fetch!(@typed_models, thread)
    typed = Repo.get_by!(model, article_id: draft.article_id)

    typed_attrs =
      attrs
      |> take(@ordinary_typed_fields)
      |> put_explicit_nil(attrs, :cover_url)
      |> put_explicit_nil(attrs, :cover_url_dark)

    typed |> model.changeset(typed_attrs) |> Repo.update()
  end

  defp put_explicit_nil(target, source, field) do
    if has_value?(source, field) and is_nil(value(source, field)),
      do: Map.put(target, field, nil),
      else: target
  end

  defp mark_edited_if_published(%Article{thread: :doc} = article, opts) do
    case public_revision(article, opts) do
      {:ok, _public, _revision} -> mark_doc_branch_edited(article, opts)
      {:error, :public_not_found} -> {:ok, article}
    end
  end

  defp mark_edited_if_published(%Article{is_edited: true} = article, _opts), do: {:ok, article}

  defp mark_edited_if_published(article, _opts) do
    if Repo.get(ArticlePublic, article.id), do: mark_edited(article), else: {:ok, article}
  end

  defp mark_edited(article), do: article |> Article.changeset(%{is_edited: true}) |> Repo.update()

  defp mark_doc_branch_edited(%Article{id: article_id} = article, opts) do
    branch_id = Keyword.fetch!(opts, :branch_id)

    case Repo.get_by(DocBranchState, article_id: article_id, branch_id: branch_id) do
      %DocBranchState{is_edited: true} ->
        {:ok, article}

      %DocBranchState{} = state ->
        case state |> DocBranchState.changeset(%{is_edited: true}) |> Repo.update() do
          {:ok, _state} -> {:ok, article}
          {:error, reason} -> {:error, reason}
        end

      nil ->
        {:error, :doc_branch_state_not_found}
    end
  end

  defp public_revision(%Article{thread: :doc, id: article_id}, opts) do
    alias CMS.Model.{DocBranchVersion, DocPublic}

    public =
      Repo.get_by(DocPublic, article_id: article_id, branch_id: Keyword.fetch!(opts, :branch_id))

    version = public && Repo.get(DocBranchVersion, public.branch_version_id)
    revision = version && Repo.get(ArticleRevision, version.revision_id)
    if public && revision, do: {:ok, public, revision}, else: {:error, :public_not_found}
  end

  defp public_revision(%Article{id: article_id}, _opts) do
    public = Repo.get(ArticlePublic, article_id)
    revision = public && Repo.get(ArticleRevision, public.revision_id)
    if public && revision, do: {:ok, public, revision}, else: {:error, :public_not_found}
  end

  defp public_revision_id(%{revision_id: revision_id}, _revision), do: revision_id
  defp public_revision_id(_public, revision), do: revision.id

  defp snapshot_to_draft(revision) do
    snapshot = Repo.get!(ArticleBodySnapshot, revision.body_snapshot_id)

    attrs =
      snapshot
      |> Map.from_struct()
      |> Map.take(
        ~w(json markdown markdown_toc html xml rss plain_text thumbnail body_hash schema_version)a
      )

    %ArticleBodyDraft{} |> ArticleBodyDraft.changeset(attrs) |> Repo.insert()
  end

  defp revision_extension(:doc, revision),
    do: present(Repo.get_by(DocRevision, revision_id: revision.id))

  defp revision_extension(thread, revision) do
    {_draft_model, revision_model} = Map.fetch!(@typed_models, thread)
    present(Repo.get_by(revision_model, revision_id: revision.id))
  end

  defp revision_attrs(revision, extension) do
    revision
    |> Map.from_struct()
    |> Map.take(@shared_fields)
    |> Map.merge(
      extension
      |> Map.from_struct()
      |> Map.take(@ordinary_typed_fields ++ @doc_fields)
    )
  end

  defp save_cover_edit(body_draft_id, attrs) do
    if has_value?(attrs, :cover_edit_info) do
      case value(attrs, :cover_edit_info) do
        nil ->
          Repo.delete_all(
            from(edit in DraftCoverEdit, where: edit.body_draft_id == ^body_draft_id)
          )

          :ok

        cover when is_map(cover) ->
          with {:ok, attrs} <- cover_attrs(cover) do
            attrs = Map.put(attrs, :body_draft_id, body_draft_id)
            edit = Repo.get(DraftCoverEdit, body_draft_id) || %DraftCoverEdit{}

            case edit |> DraftCoverEdit.changeset(attrs) |> Repo.insert_or_update() do
              {:ok, _edit} -> :ok
              {:error, reason} -> {:error, reason}
            end
          end
      end
    else
      :ok
    end
  end

  defp validate_cover(attrs) do
    cover_touched = has_value?(attrs, :cover_url) or has_value?(attrs, :cover_edit_info)
    cover_url = value(attrs, :cover_url)
    cover_edit = value(attrs, :cover_edit_info)
    raw_background? = raw_cover_background?(cover_edit)

    cond do
      not cover_touched -> :ok
      is_nil(cover_url) and is_nil(cover_edit) -> :ok
      is_binary(cover_url) and is_map(cover_edit) and not raw_background? -> :ok
      true -> {:error, :invalid_cover_configuration}
    end
  end

  defp raw_cover_background?(cover) when is_map(cover) do
    Enum.any?([:light, :dark], fn theme ->
      theme_config = value(cover, theme) || %{}
      not is_nil(value(theme_config, :background_id))
    end)
  end

  defp raw_cover_background?(_cover), do: false

  defp copy_revision_cover_edit(revision_id, body_draft_id) do
    case Repo.get(CMS.Model.RevisionCoverEdit, revision_id) do
      nil ->
        :ok

      edit ->
        attrs =
          edit
          |> Map.from_struct()
          |> Map.take(~w(canvas_width canvas_height version light_background_id
                         light_original_background_id light_images dark_background_id
                         dark_original_background_id dark_images)a)
          |> Map.put(:body_draft_id, body_draft_id)

        case %DraftCoverEdit{} |> DraftCoverEdit.changeset(attrs) |> Repo.insert() do
          {:ok, _edit} -> :ok
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp cover_attrs(cover) do
    light = value(cover, :light) || %{}
    dark = value(cover, :dark) || %{}

    with {:ok, light_background_id} <- insert_cover_background(value(light, :background)),
         {:ok, light_original_background_id} <-
           insert_cover_background(value(light, :original_background)),
         {:ok, dark_background_id} <- insert_cover_background(value(dark, :background)),
         {:ok, dark_original_background_id} <-
           insert_cover_background(value(dark, :original_background)) do
      {:ok,
       %{
         canvas_width: value(cover, :canvas_width),
         canvas_height: value(cover, :canvas_height),
         version: value(cover, :version) || 1,
         light_background_id: light_background_id,
         light_original_background_id: light_original_background_id,
         light_images: value(light, :images) || [],
         dark_background_id: dark_background_id,
         dark_original_background_id: dark_original_background_id,
         dark_images: value(dark, :images) || []
       }}
    end
  end

  defp insert_cover_background(nil), do: {:ok, nil}

  defp insert_cover_background(attrs) when is_map(attrs) do
    %CoverBackground{}
    |> CoverBackground.changeset(attrs)
    |> Repo.insert()
    |> case do
      {:ok, background} -> {:ok, background.id}
      {:error, _reason} = error -> error
    end
  end

  defp maybe_replace_tags(article, draft, attrs) do
    if Map.has_key?(attrs, :tag_ids) or Map.has_key?(attrs, "tag_ids") or
         Map.has_key?(attrs, :community_tags) or Map.has_key?(attrs, "community_tags"),
       do: replace_tags(article, draft, tag_ids(attrs)),
       else: :ok
  end

  defp replace_tags(article, draft, ids) do
    with :ok <- delete_tags(article, draft) do
      table = "#{article.thread}_draft_tags"
      branch_columns = if article.thread == :doc, do: ", branch_id", else: ""
      branch_values = if article.thread == :doc, do: ", $3", else: ""

      Enum.reduce_while(ids, :ok, fn tag_id, :ok ->
        params =
          [Ecto.UUID.dump!(article.id), tag_id] ++
            if(article.thread == :doc, do: [draft.branch_id], else: [])

        case Repo.query(
               "INSERT INTO cms.#{table} (article_id, tag_id#{branch_columns}) VALUES ($1, $2#{branch_values})",
               params
             ) do
          {:ok, _} -> {:cont, :ok}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
    end
  end

  defp delete_tags(article, draft) do
    table = "#{article.thread}_draft_tags"
    branch = if article.thread == :doc, do: " AND branch_id = $2", else: ""

    params =
      [Ecto.UUID.dump!(article.id)] ++ if(article.thread == :doc, do: [draft.branch_id], else: [])

    case Repo.query("DELETE FROM cms.#{table} WHERE article_id = $1#{branch}", params) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp copy_revision_tags(article, draft, revision) do
    source = "#{article.thread}_revision_tags"
    target = "#{article.thread}_draft_tags"
    branch_column = if article.thread == :doc, do: ", branch_id", else: ""
    branch_value = if article.thread == :doc, do: ", $3", else: ""

    params =
      [Ecto.UUID.dump!(article.id), Ecto.UUID.dump!(revision.id)] ++
        if(article.thread == :doc, do: [draft.branch_id], else: [])

    case Repo.query(
           "INSERT INTO cms.#{target} (article_id, tag_id#{branch_column}) SELECT $1, tag_id#{branch_value} FROM cms.#{source} WHERE revision_id = $2",
           params
         ) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp delete_typed_draft(%Article{thread: :doc}, _draft), do: :ok

  defp delete_typed_draft(%Article{thread: thread}, draft) do
    {model, _revision_model} = Map.fetch!(@typed_models, thread)

    case Repo.get_by(model, article_id: draft.article_id) do
      nil ->
        :ok

      typed ->
        case Repo.delete(typed) do
          {:ok, _} -> :ok
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp content_hash(%Article{thread: thread} = article, attrs, body, draft) do
    fields =
      if thread == :doc,
        do: @shared_fields ++ @doc_fields,
        else: @shared_fields ++ @ordinary_typed_fields

    stored = stored_typed_fields(article, draft)

    tags =
      if has_value?(attrs, :tag_ids), do: tag_ids(attrs), else: stored_tag_ids(article, draft)

    payload = %{
      fields:
        Enum.into(fields, %{}, fn field ->
          {field,
           value(attrs, field) || (draft && Map.get(draft, field)) || Map.get(stored, field)}
        end),
      body_hash: body.body_hash,
      tag_ids: Enum.sort(tags),
      cover_edit: ContentFingerprint.draft(body.id)
    }

    :crypto.hash(:sha256, CanonicalJSON.encode(payload)) |> Base.encode16(case: :lower)
  end

  defp set_content_hash(draft, content_hash) do
    draft
    |> Ecto.Changeset.change(content_hash: content_hash)
    |> Repo.update()
  end

  defp tag_ids(attrs),
    do:
      (value(attrs, :tag_ids) || value(attrs, :community_tags) || [])
      |> Enum.map(&normalize_tag_id/1)
      |> Enum.uniq()

  defp normalize_tag_id(id) when is_integer(id), do: id

  defp normalize_tag_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {value, ""} -> value
      _ -> id
    end
  end

  defp has_value?(attrs, key),
    do: Map.has_key?(attrs, key) or Map.has_key?(attrs, Atom.to_string(key))

  defp stored_typed_fields(%Article{thread: :doc}, %DocDraft{} = draft),
    do: Map.take(Map.from_struct(draft), @doc_fields)

  defp stored_typed_fields(%Article{thread: :doc}, nil), do: %{}

  defp stored_typed_fields(%Article{thread: thread, id: article_id}, _draft) do
    {model, _revision_model} = Map.fetch!(@typed_models, thread)

    case Repo.get_by(model, article_id: article_id) do
      nil -> %{}
      typed -> Map.take(Map.from_struct(typed), @ordinary_typed_fields)
    end
  end

  defp stored_tag_ids(_article, nil), do: []

  defp stored_tag_ids(article, draft) do
    table = "#{article.thread}_draft_tags"
    branch = if article.thread == :doc, do: " AND branch_id = $2", else: ""

    params =
      [Ecto.UUID.dump!(article.id)] ++ if(article.thread == :doc, do: [draft.branch_id], else: [])

    %{rows: rows} =
      Repo.query!("SELECT tag_id FROM cms.#{table} WHERE article_id = $1#{branch}", params)

    Enum.map(rows, fn [tag_id] -> tag_id end)
  end

  defp insert_lifecycle(%Article{thread: :doc} = article, opts) do
    %DocLifecycle{}
    |> DocLifecycle.changeset(%{
      article_id: article.id,
      community_id: article.community_id,
      branch_id: Keyword.fetch!(opts, :branch_id),
      state: :draft_only,
      version: 1,
      changed_at: DateTime.utc_now(:second)
    })
    |> Repo.insert()
  end

  defp insert_lifecycle(%Article{} = article, _opts) do
    %ArticleLifecycle{}
    |> ArticleLifecycle.changeset(%{
      article_id: article.id,
      community_id: article.community_id,
      thread: article.thread,
      state: :draft_only,
      version: 1,
      changed_at: DateTime.utc_now(:second)
    })
    |> Repo.insert()
  end

  defp insert_home_community(%Article{} = article) do
    %ArticleCommunity{}
    |> ArticleCommunity.changeset(%{
      article_id: article.id,
      community_id: article.community_id,
      role: :home,
      visible: true
    })
    |> Repo.insert()
  end

  defp insert_branch_state(%Article{thread: :doc} = article, opts) do
    %DocBranchState{}
    |> DocBranchState.changeset(%{
      article_id: article.id,
      branch_id: Keyword.fetch!(opts, :branch_id),
      moderation_state: :legal
    })
    |> Repo.insert()
  end

  defp insert_branch_state(%Article{}, _opts), do: {:ok, :not_applicable}

  defp discard_existing_workspace(article, opts) do
    case get(article, opts) do
      {:ok, draft} ->
        with :ok <- maybe_ensure_version(draft, Keyword.get(opts, :expected_version)) do
          delete_workspace(article, draft)
        end

      {:error, :not_found} ->
        :ok
    end
  end

  defp maybe_ensure_version(_draft, nil), do: :ok
  defp maybe_ensure_version(draft, expected_version), do: ensure_version(draft, expected_version)

  defp take(attrs, fields),
    do:
      Enum.reduce(fields, %{}, fn field, acc ->
        case value(attrs, field) do
          nil -> acc
          item -> Map.put(acc, field, item)
        end
      end)

  defp value(attrs, key), do: Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key))
end
