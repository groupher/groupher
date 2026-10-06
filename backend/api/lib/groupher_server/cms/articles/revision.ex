defmodule GroupherServer.CMS.Articles.Revision do
  @moduledoc """
  Materializes immutable published content from the current mutable workspace.

      ArticleDraft / DocDraft
               |
               `-> ArticleBodySnapshot + ArticleRevision + typed extension + tags

  Callers must run creation inside the owning Publish transaction. This module
  never advances Public, Lifecycle, or a Doc branch head by itself.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleBodyDraft,
    ArticleBodySnapshot,
    ArticleDraft,
    ArticleRevision,
    BlogDraft,
    BlogRevision,
    ChangelogDraft,
    ChangelogRevision,
    DocDraft,
    DocRevision,
    DraftCoverEdit,
    PostDraft,
    PostRevision,
    RevisionCover,
    RevisionCoverEdit
  }

  @typed_models %{
    post: {PostDraft, PostRevision},
    blog: {BlogDraft, BlogRevision},
    changelog: {ChangelogDraft, ChangelogRevision},
    doc: {DocDraft, DocRevision}
  }
  @ordinary_threads ~w(post blog changelog)a
  @retention_days 7

  @doc "Creates one immutable Revision and all thread-owned immutable relations."
  @spec create(Article.t(), ArticleDraft.t() | DocDraft.t()) ::
          {:ok, ArticleRevision.t()} | {:error, Ecto.Changeset.t() | term()}
  def create(%Article{} = article, draft) do
    with :ok <- validate_draft_owner(article, draft),
         {:ok, body_draft} <- fetch_body_draft(draft),
         {:ok, body_snapshot} <- materialize_body_snapshot(body_draft),
         {:ok, revision} <- insert_revision(article, draft, body_snapshot),
         :ok <- copy_asset_refs(body_draft.id, revision.id),
         :ok <- copy_cover_state(body_draft.id, revision.id),
         {:ok, _extension} <- insert_typed_extension(article.thread, draft, revision),
         :ok <- copy_tags(article.thread, draft, revision) do
      {:ok, revision}
    end
  end

  @doc "Loads a Revision only when it belongs to the supplied stable Article."
  @spec get(Article.t(), Ecto.UUID.t()) :: {:ok, ArticleRevision.t()} | {:error, :not_found}
  def get(%Article{id: article_id}, revision_id) do
    case Repo.get_by(ArticleRevision, id: revision_id, article_id: article_id) do
      %ArticleRevision{} = revision -> {:ok, revision}
      nil -> {:error, :not_found}
    end
  end

  @doc "Returns the typed immutable extension for one Article Revision."
  @spec get_extension(Article.t(), ArticleRevision.t()) :: {:ok, struct()} | {:error, :not_found}
  def get_extension(%Article{thread: thread}, %ArticleRevision{id: revision_id}) do
    {_draft_model, revision_model} = Map.fetch!(@typed_models, thread)

    case Repo.get_by(revision_model, revision_id: revision_id) do
      nil -> {:error, :not_found}
      extension -> {:ok, extension}
    end
  end

  defp validate_draft_owner(%Article{id: id, thread: thread}, %ArticleDraft{article_id: id})
       when thread in @ordinary_threads do
    :ok
  end

  defp validate_draft_owner(%Article{id: id, thread: :doc}, %DocDraft{article_id: id}), do: :ok
  defp validate_draft_owner(_article, _draft), do: {:error, :revision_owner_mismatch}

  defp fetch_body_draft(%{body_draft_id: body_draft_id}) do
    case Repo.get(ArticleBodyDraft, body_draft_id) do
      %ArticleBodyDraft{} = body -> {:ok, body}
      nil -> {:error, :body_draft_not_found}
    end
  end

  defp materialize_body_snapshot(%ArticleBodyDraft{} = body) do
    attrs =
      body
      |> Map.from_struct()
      |> Map.take(
        ~w(json markdown markdown_toc html xml rss plain_text thumbnail body_hash schema_version)a
      )

    case %ArticleBodySnapshot{}
         |> ArticleBodySnapshot.changeset(attrs)
         |> Repo.insert(
           on_conflict: :nothing,
           conflict_target: [:body_hash, :schema_version]
         ) do
      {:ok, _candidate} ->
        {:ok,
         Repo.get_by!(ArticleBodySnapshot,
           body_hash: body.body_hash,
           schema_version: body.schema_version
         )}

      error ->
        error
    end
  end

  defp insert_revision(article, draft, body_snapshot) do
    cleanup_after = DateTime.add(DateTime.utc_now(), @retention_days, :day)

    %ArticleRevision{}
    |> ArticleRevision.changeset(%{
      article_id: article.id,
      body_snapshot_id: body_snapshot.id,
      title: draft.title,
      digest: draft.digest,
      slug: draft.slug,
      content_hash: draft.content_hash,
      schema_version: body_snapshot.schema_version,
      cleanup_after: cleanup_after
    })
    |> Repo.insert()
  end

  defp copy_asset_refs(body_draft_id, revision_id) do
    now = DateTime.utc_now(:second)

    rows =
      ArticleAssetRef
      |> where([ref], ref.body_draft_id == ^body_draft_id)
      |> Repo.all()
      |> Enum.map(fn ref ->
        ref
        |> Map.from_struct()
        |> Map.take(
          ~w(community_id asset_id usage block_id block_type position title alt source meta)a
        )
        |> Map.merge(%{revision_id: revision_id, inserted_at: now, updated_at: now})
      end)

    case Repo.insert_all(ArticleAssetRef, rows) do
      {_count, _rows} -> :ok
    end
  end

  defp copy_cover_state(body_draft_id, revision_id) do
    with :ok <- copy_cover_edit(body_draft_id, revision_id),
         :ok <- copy_cover_assets(revision_id) do
      :ok
    end
  end

  defp copy_cover_edit(body_draft_id, revision_id) do
    case Repo.get(DraftCoverEdit, body_draft_id) do
      nil ->
        :ok

      edit ->
        attrs =
          edit
          |> Map.from_struct()
          |> Map.take(~w(canvas_width canvas_height version light_background_id
                         light_original_background_id light_images dark_background_id
                         dark_original_background_id dark_images)a)
          |> Map.put(:revision_id, revision_id)

        case %RevisionCoverEdit{} |> RevisionCoverEdit.changeset(attrs) |> Repo.insert() do
          {:ok, _edit} -> :ok
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp copy_cover_assets(revision_id) do
    refs =
      ArticleAssetRef
      |> where([ref], ref.revision_id == ^revision_id and ref.usage in [:cover, :cover_dark])
      |> Repo.all()

    Enum.reduce_while(refs, :ok, fn ref, :ok ->
      theme = if ref.usage == :cover_dark, do: :dark, else: :light

      case %RevisionCover{}
           |> RevisionCover.changeset(%{
             revision_id: revision_id,
             asset_id: ref.asset_id,
             theme: theme
           })
           |> Repo.insert() do
        {:ok, _cover} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp insert_typed_extension(thread, draft, revision) do
    {draft_model, revision_model} = Map.fetch!(@typed_models, thread)
    typed_draft = Repo.get_by(draft_model, typed_draft_filter(thread, draft))
    attrs = extension_attrs(thread, typed_draft || struct(draft_model))

    revision_model
    |> struct()
    |> revision_model.changeset(Map.put(attrs, :revision_id, revision.id))
    |> Repo.insert()
  end

  defp typed_draft_filter(:doc, draft) do
    [article_id: draft.article_id, branch_id: draft.branch_id]
  end

  defp typed_draft_filter(_thread, draft), do: [article_id: draft.article_id]

  defp extension_attrs(:doc, draft) do
    Map.take(
      Map.from_struct(draft),
      ~w(subtitle link_addr template_key cover_url cover_url_dark)a
    )
  end

  defp extension_attrs(_thread, draft) do
    Map.take(Map.from_struct(draft), ~w(copy_right link_addr cover_url cover_url_dark)a)
  end

  defp copy_tags(thread, draft, revision) do
    source = "#{thread}_draft_tags"
    target = "#{thread}_revision_tags"
    branch_clause = if thread == :doc, do: " AND branch_id = $3", else: ""

    params =
      if thread == :doc,
        do: [Ecto.UUID.dump!(revision.id), Ecto.UUID.dump!(draft.article_id), draft.branch_id],
        else: [Ecto.UUID.dump!(revision.id), Ecto.UUID.dump!(draft.article_id)]

    Repo.query(
      "INSERT INTO cms.#{target} (revision_id, tag_id) SELECT $1, tag_id FROM cms.#{source} WHERE article_id = $2#{branch_clause}",
      params
    )
    |> case do
      {:ok, _result} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end
end
