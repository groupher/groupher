defmodule GroupherServer.CMS.Articles.Draft.Tags do
  @moduledoc """
  Owns Ecto persistence for legacy Docs Draft and Revision tags.

      Draft / Revision workflow
          -> Draft.Tags
          -> cms.doc_draft_tags / cms.doc_revision_tags

  The physical tables are join tables without dedicated Ecto schemas. This
  module keeps their source selection and branch scope in one place while using
  Ecto query and bulk APIs for all row operations.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{Article, ArticleRevision, DocDraft}
  alias Helper.Constant.DBPrefix

  @cms_prefix DBPrefix.cms()

  @draft_table "doc_draft_tags"
  @revision_table "doc_revision_tags"

  @doc """
  Replaces all tags for one draft, preserving the doc branch scope.

  Uses [`Ecto.Repo.delete_all/2`](https://hexdocs.pm/ecto/Ecto.Repo.html#delete_all/2)
  and [`Ecto.Repo.insert_all/3`](https://hexdocs.pm/ecto/Ecto.Repo.html#insert_all/3).
  """
  @spec replace(Article.t(), DocDraft.t(), [term()]) ::
          {:ok, :pass} | {:error, term()}
  def replace(%Article{thread: :doc} = article, %DocDraft{} = draft, tag_ids) do
    with {:ok, :pass} <- delete_draft(article, draft) do
      insert_draft(article, draft, tag_ids)
    end
  end

  @doc "Deletes all tags for one draft, preserving the doc branch scope."
  @spec delete(Article.t(), DocDraft.t()) ::
          {:ok, :pass} | {:error, term()}
  def delete(%Article{thread: :doc} = article, %DocDraft{} = draft),
    do: delete_draft(article, draft)

  @doc """
  Copies revision tags into a new draft using one Ecto insert-all query.

  See [`Ecto.Repo.insert_all/3`](https://hexdocs.pm/ecto/Ecto.Repo.html#insert_all/3).
  """
  @spec copy_revision(Article.t(), DocDraft.t(), ArticleRevision.t()) ::
          {:ok, :pass} | {:error, term()}
  def copy_revision(
        %Article{thread: :doc} = article,
        %DocDraft{} = draft,
        %ArticleRevision{} = revision
      ) do
    source = @revision_table
    target = @draft_table
    revision_id = Ecto.UUID.dump!(revision.id)
    article_id = Ecto.UUID.dump!(article.id)

    source_query =
      from(row in source,
        where: field(row, :revision_id) == ^revision_id,
        select: %{
          article_id: ^article_id,
          tag_id: field(row, :tag_id),
          branch_id: ^draft.branch_id
        }
      )

    case Repo.insert_all(target, source_query, prefix: @cms_prefix) do
      {_count, _rows} -> {:ok, :pass}
    end
  end

  @doc """
  Copies draft tags into a new revision using one Ecto insert-all query.

  See [`Ecto.Repo.insert_all/3`](https://hexdocs.pm/ecto/Ecto.Repo.html#insert_all/3).
  """
  @spec copy_to_revision(atom(), DocDraft.t(), ArticleRevision.t()) ::
          {:ok, :pass} | {:error, term()}
  def copy_to_revision(:doc, %DocDraft{} = draft, %ArticleRevision{} = revision) do
    source = @draft_table
    target = @revision_table
    article_id = Ecto.UUID.dump!(draft.article_id)
    revision_id = Ecto.UUID.dump!(revision.id)

    source_query =
      from(row in source,
        where:
          field(row, :article_id) == ^article_id and field(row, :branch_id) == ^draft.branch_id,
        select: %{revision_id: ^revision_id, tag_id: field(row, :tag_id)}
      )

    case Repo.insert_all(target, source_query, prefix: @cms_prefix) do
      {_count, _rows} -> {:ok, :pass}
    end
  end

  @doc "Returns sorted tag ids stored for one draft."
  @spec draft_ids(Article.t(), DocDraft.t()) :: [term()]
  def draft_ids(%Article{thread: :doc} = article, %DocDraft{} = draft) do
    table = @draft_table

    query =
      from(row in table,
        where:
          field(row, :article_id) == ^Ecto.UUID.dump!(article.id) and
            field(row, :branch_id) == ^draft.branch_id,
        select: field(row, :tag_id)
      )

    query
    |> Repo.all(prefix: @cms_prefix)
    |> Enum.sort()
  end

  defp delete_draft(%Article{} = article, draft) do
    table = @draft_table

    query =
      from(row in table,
        where:
          field(row, :article_id) == ^Ecto.UUID.dump!(article.id) and
            field(row, :branch_id) == ^draft.branch_id
      )

    case Repo.delete_all(query, prefix: @cms_prefix) do
      {_count, _rows} -> {:ok, :pass}
    end
  end

  defp insert_draft(%Article{} = article, draft, tag_ids) do
    base = %{article_id: Ecto.UUID.dump!(article.id)}

    rows =
      Enum.map(tag_ids, fn tag_id ->
        row = Map.put(base, :tag_id, tag_id)
        Map.put(row, :branch_id, draft.branch_id)
      end)

    case Repo.insert_all(@draft_table, rows, prefix: @cms_prefix) do
      {count, _rows} when count == length(rows) -> {:ok, :pass}
      {count, _rows} -> {:error, {:draft_tags_inserted, count, length(rows)}}
    end
  end
end
