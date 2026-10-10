defmodule GroupherServer.CMS.Articles.Draft.Tags do
  @moduledoc """
  Owns Ecto persistence for the thread-specific draft and revision tag tables.

      Draft / Revision workflow
          -> Draft.Tags
          -> typed table source selected from a closed thread set
          -> cms.*_draft_tags / cms.*_revision_tags

  The physical tables are join tables without dedicated Ecto schemas. This
  module keeps their source selection and branch scope in one place while using
  Ecto query and bulk APIs for all row operations.
  """

  import Ecto.Query

  alias GroupherServer.Repo
  alias GroupherServer.CMS.Model.{Article, ArticleDraft, ArticleRevision, DocDraft}
  alias Helper.Constant.DBPrefix

  @cms_prefix DBPrefix.cms()

  @draft_tables %{
    post: "post_draft_tags",
    blog: "blog_draft_tags",
    changelog: "changelog_draft_tags",
    doc: "doc_draft_tags"
  }
  @revision_tables %{
    post: "post_revision_tags",
    blog: "blog_revision_tags",
    changelog: "changelog_revision_tags",
    doc: "doc_revision_tags"
  }

  @doc """
  Replaces all tags for one draft, preserving the doc branch scope.

  Uses [`Ecto.Repo.delete_all/2`](https://hexdocs.pm/ecto/Ecto.Repo.html#delete_all/2)
  and [`Ecto.Repo.insert_all/3`](https://hexdocs.pm/ecto/Ecto.Repo.html#insert_all/3).
  """
  @spec replace(Article.t(), ArticleDraft.t() | DocDraft.t(), [term()]) ::
          {:ok, :pass} | {:error, term()}
  def replace(%Article{} = article, draft, tag_ids) do
    with {:ok, :pass} <- delete_draft(article, draft),
         {:ok, :pass} <- insert_draft(article, draft, tag_ids) do
      {:ok, :pass}
    end
  end

  @doc "Deletes all tags for one draft, preserving the doc branch scope."
  @spec delete(Article.t(), ArticleDraft.t() | DocDraft.t()) ::
          {:ok, :pass} | {:error, term()}
  def delete(%Article{} = article, draft), do: delete_draft(article, draft)

  @doc """
  Copies revision tags into a new draft using one Ecto insert-all query.

  See [`Ecto.Repo.insert_all/3`](https://hexdocs.pm/ecto/Ecto.Repo.html#insert_all/3).
  """
  @spec copy_revision(Article.t(), ArticleDraft.t() | DocDraft.t(), ArticleRevision.t()) ::
          {:ok, :pass} | {:error, term()}
  def copy_revision(%Article{} = article, draft, %ArticleRevision{} = revision) do
    source = table!(article.thread, :revision)
    target = table!(article.thread, :draft)
    revision_id = Ecto.UUID.dump!(revision.id)
    article_id = Ecto.UUID.dump!(article.id)

    source_query =
      from(row in source,
        where: field(row, :revision_id) == ^revision_id,
        select: %{article_id: ^article_id, tag_id: field(row, :tag_id)}
      )

    source_query =
      if article.thread == :doc do
        from(row in source_query,
          select_merge: %{branch_id: ^draft.branch_id}
        )
      else
        source_query
      end

    case Repo.insert_all(target, source_query, prefix: @cms_prefix) do
      {_count, _rows} -> {:ok, :pass}
    end
  end

  @doc """
  Copies draft tags into a new revision using one Ecto insert-all query.

  See [`Ecto.Repo.insert_all/3`](https://hexdocs.pm/ecto/Ecto.Repo.html#insert_all/3).
  """
  @spec copy_to_revision(atom(), ArticleDraft.t() | DocDraft.t(), ArticleRevision.t()) ::
          {:ok, :pass} | {:error, term()}
  def copy_to_revision(thread, draft, %ArticleRevision{} = revision) do
    source = table!(thread, :draft)
    target = table!(thread, :revision)
    article_id = Ecto.UUID.dump!(draft.article_id)
    revision_id = Ecto.UUID.dump!(revision.id)

    source_query =
      from(row in source,
        where: field(row, :article_id) == ^article_id,
        select: %{revision_id: ^revision_id, tag_id: field(row, :tag_id)}
      )

    source_query =
      if thread == :doc do
        from(row in source_query, where: field(row, :branch_id) == ^draft.branch_id)
      else
        source_query
      end

    case Repo.insert_all(target, source_query, prefix: @cms_prefix) do
      {_count, _rows} -> {:ok, :pass}
    end
  end

  @doc "Returns sorted tag ids stored for one draft."
  @spec draft_ids(Article.t(), ArticleDraft.t() | DocDraft.t()) :: [term()]
  def draft_ids(%Article{} = article, draft) do
    table = table!(article.thread, :draft)

    query =
      from(row in table,
        where: field(row, :article_id) == ^Ecto.UUID.dump!(article.id),
        select: field(row, :tag_id)
      )

    query =
      if article.thread == :doc do
        from(row in query, where: field(row, :branch_id) == ^draft.branch_id)
      else
        query
      end

    query
    |> Repo.all(prefix: @cms_prefix)
    |> Enum.sort()
  end

  @doc "Returns sorted tag ids stored for one revision."
  @spec revision_ids(atom(), Ecto.UUID.t()) :: [term()]
  def revision_ids(thread, revision_id) do
    table = table!(thread, :revision)

    from(row in table,
      where: field(row, :revision_id) == ^Ecto.UUID.dump!(revision_id),
      select: field(row, :tag_id)
    )
    |> Repo.all(prefix: @cms_prefix)
    |> Enum.sort()
  end

  defp delete_draft(%Article{} = article, draft) do
    table = table!(article.thread, :draft)

    query =
      from(row in table,
        where: field(row, :article_id) == ^Ecto.UUID.dump!(article.id)
      )

    query =
      if article.thread == :doc do
        from(row in query, where: field(row, :branch_id) == ^draft.branch_id)
      else
        query
      end

    case Repo.delete_all(query, prefix: @cms_prefix) do
      {_count, _rows} -> {:ok, :pass}
    end
  end

  defp insert_draft(%Article{} = article, draft, tag_ids) do
    base = %{article_id: Ecto.UUID.dump!(article.id)}

    rows =
      Enum.map(tag_ids, fn tag_id ->
        row = Map.put(base, :tag_id, tag_id)
        if article.thread == :doc, do: Map.put(row, :branch_id, draft.branch_id), else: row
      end)

    case Repo.insert_all(table!(article.thread, :draft), rows, prefix: @cms_prefix) do
      {count, _rows} when count == length(rows) -> {:ok, :pass}
      {count, _rows} -> {:error, {:draft_tags_inserted, count, length(rows)}}
    end
  end

  defp table!(thread, kind) when kind in [:draft, :revision] do
    tables = if kind == :draft, do: @draft_tables, else: @revision_tables
    Map.fetch!(tables, thread)
  end
end
