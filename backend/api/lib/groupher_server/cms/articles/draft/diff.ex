defmodule GroupherServer.CMS.Articles.Draft.Diff do
  @moduledoc """
  Compares one mutable Draft with the immutable Revision selected by Public.

      ArticleDraft.content_hash
        <-> ArticlePublic.revision_id -> ArticleRevision.content_hash

  The hash is the fast path. Field details are computed only when the hashes
  differ and never create a Revision or mutate either head.
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.ContentFingerprint

  alias CMS.Model.{
    Article,
    ArticleBodyDraft,
    ArticleBodySnapshot,
    ArticleDraft,
    ArticlePublic,
    ArticleRevision,
    BlogDraft,
    BlogRevision,
    ChangelogDraft,
    ChangelogRevision,
    DocDraft,
    DocRevision,
    PostDraft,
    PostRevision
  }

  @shared_fields ~w(title digest slug)a
  @ordinary_typed_fields ~w(copy_right link_addr cover_url cover_url_dark)a
  @doc_typed_fields ~w(subtitle link_addr template_key cover_url cover_url_dark)a
  @typed_models %{
    post: {PostDraft, PostRevision},
    blog: {BlogDraft, BlogRevision},
    changelog: {ChangelogDraft, ChangelogRevision}
  }

  @doc "Returns whether a stable Article currently has unpublished Draft content."
  @spec unpublished?(Article.t()) :: {:ok, boolean()} | {:error, term()}
  def unpublished?(%Article{} = article) do
    draft = Repo.get(ArticleDraft, article.id)
    public = Repo.get(ArticlePublic, article.id)

    {:ok, unpublished?(draft, public)}
  end

  @doc "Returns the changed content fields between Draft and the selected public Revision."
  @spec compare(Article.t()) :: {:ok, map()} | {:error, term()}
  def compare(%Article{} = article) do
    draft = Repo.get(ArticleDraft, article.id)
    public = Repo.get(ArticlePublic, article.id)

    case {draft, public} do
      {nil, _public} ->
        {:ok, %{has_unpublished_changes: false, changed_fields: []}}

      {%ArticleDraft{}, nil} ->
        {:ok, %{has_unpublished_changes: true, changed_fields: @shared_fields}}

      {%ArticleDraft{} = draft, %ArticlePublic{} = public} ->
        revision = Repo.get!(ArticleRevision, public.revision_id)

        changed_fields =
          if draft.content_hash == revision.content_hash do
            []
          else
            changed_fields(article, draft, revision)
          end

        {:ok,
         %{
           has_unpublished_changes: changed_fields != [],
           changed_fields: changed_fields,
           draft_content_hash: draft.content_hash,
           public_content_hash: revision.content_hash
         }}
    end
  end

  @doc "Returns content fields changed by a loaded Draft during Publish."
  @spec publish_changed_fields(Article.t(), ArticleDraft.t(), ArticleRevision.t()) :: [atom()]
  def publish_changed_fields(
        %Article{} = article,
        %ArticleDraft{} = draft,
        %ArticleRevision{} = revision
      ),
      do: changed_fields(article, draft, revision)

  defp unpublished?(nil, _public), do: false
  defp unpublished?(%ArticleDraft{}, nil), do: true

  defp unpublished?(%ArticleDraft{} = draft, %ArticlePublic{} = public) do
    Repo.get!(ArticleRevision, public.revision_id).content_hash != draft.content_hash
  end

  defp changed_fields(article, draft, revision) do
    fields =
      Enum.reduce(@shared_fields, [], fn field, acc ->
        maybe_changed(acc, field, Map.get(draft, field), Map.get(revision, field))
      end)

    fields
    |> maybe_changed(:body_hash, body_hash(draft) != body_hash(revision))
    |> maybe_changed(:typed_fields, typed_fields(article, draft, revision))
    |> maybe_changed(:tags, tag_ids(article, draft) != tag_ids(article, revision))
    |> maybe_changed(:cover_edit, cover_edit(draft) != cover_edit(revision))
    |> ensure_content_change()
  end

  defp maybe_changed(fields, field, true), do: fields ++ [field]
  defp maybe_changed(fields, _field, false), do: fields
  defp maybe_changed(fields, field, left, right), do: maybe_changed(fields, field, left != right)

  defp ensure_content_change([]), do: [:content_hash]
  defp ensure_content_change(fields), do: fields

  defp body_hash(%{body_draft_id: body_draft_id}),
    do: Repo.get!(ArticleBodyDraft, body_draft_id).body_hash

  defp body_hash(%ArticleRevision{body_snapshot_id: snapshot_id}),
    do: Repo.get!(ArticleBodySnapshot, snapshot_id).body_hash

  defp typed_fields(%Article{thread: :doc}, %DocDraft{} = draft, %ArticleRevision{} = revision) do
    draft_values = Map.take(Map.from_struct(draft), @doc_typed_fields)

    revision_values =
      Repo.get_by!(DocRevision, revision_id: revision.id)
      |> Map.from_struct()
      |> Map.take(@doc_typed_fields)

    draft_values != revision_values
  end

  defp typed_fields(%Article{thread: thread, id: article_id}, %ArticleDraft{}, %ArticleRevision{
         id: revision_id
       }) do
    {draft_model, revision_model} = Map.fetch!(@typed_models, thread)

    draft_values =
      Repo.get_by!(draft_model, article_id: article_id)
      |> Map.from_struct()
      |> Map.take(@ordinary_typed_fields)

    revision_values =
      Repo.get_by!(revision_model, revision_id: revision_id)
      |> Map.from_struct()
      |> Map.take(@ordinary_typed_fields)

    draft_values != revision_values
  end

  defp cover_edit(%{body_draft_id: body_draft_id}), do: ContentFingerprint.draft(body_draft_id)
  defp cover_edit(%ArticleRevision{id: revision_id}), do: ContentFingerprint.revision(revision_id)

  defp tag_ids(%Article{thread: thread}, draft) when is_struct(draft, DocDraft) do
    query_tag_ids("#{thread}_draft_tags", "article_id = $1 AND branch_id = $2", [
      Ecto.UUID.dump!(draft.article_id),
      draft.branch_id
    ])
  end

  defp tag_ids(%Article{thread: thread}, %ArticleDraft{article_id: article_id}) do
    query_tag_ids("#{thread}_draft_tags", "article_id = $1", [Ecto.UUID.dump!(article_id)])
  end

  defp tag_ids(%Article{thread: thread}, %ArticleRevision{id: revision_id}) do
    query_tag_ids("#{thread}_revision_tags", "revision_id = $1", [Ecto.UUID.dump!(revision_id)])
  end

  defp query_tag_ids(table, where, params) do
    %{rows: rows} = Repo.query!("SELECT tag_id FROM cms.#{table} WHERE #{where}", params)
    rows |> Enum.map(fn [tag_id] -> tag_id end) |> Enum.sort()
  end
end
