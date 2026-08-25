defmodule GroupherServer.Activity.ArticleLog do
  @moduledoc """
  Reads an Article's permission-aware public ArticleLog surface.

      Article read scope -> contract-visible action subset -> safe projection
  """

  alias GroupherServer.CMS.Artiment.Matcher
  import Ecto.Query, warn: false

  alias GroupherServer.Activity.Artiment
  alias GroupherServer.CMS.Articles.ErrorCat, as: ArticlesErrorCat
  alias GroupherServer.CMS.Gate
  alias GroupherServer.CMS.Gate.Context.Scope.Article, as: ArticleScope
  alias GroupherServer.CMS.Gate.Context.Scope.Doc, as: DocScope
  alias GroupherServer.Repo
  alias Helper.ORM

  @page_size 20

  def list(article, actor, filter) do
    with {:ok, canonical} <- authorize_read(article, actor),
         {:ok, handler} <- Artiment.handler(canonical),
         {:ok, page} <- pagination(filter) do
      actions = handler.surface_actions(:article_log)
      stream_ref = to_string(canonical.article_hash_id)

      query =
        handler.schema()
        |> where([log], field(log, ^handler.stream_field()) == ^stream_ref)
        |> where([log], log.action in ^actions)
        |> maybe_branch(canonical)
        |> order_by([log], desc: log.occurred_at, desc: log.record_sequence)

      paged = ORM.paginator(query, page: page, size: @page_size)

      {:ok,
       Map.update!(paged, :entries, fn entries ->
         Enum.map(entries, fn log ->
           {:ok, projected} = handler.project(log, :article_log)
           projected
         end)
       end)}
    end
  end

  defp authorize_read(article, actor) do
    with {:ok, %{thread: thread}} <- Matcher.match(article),
         {:ok, action, context} <- scope_context(article, thread),
         %Ecto.Query{} = query <- Gate.scope(article.__struct__, actor, action, context),
         canonical when not is_nil(canonical) <-
           query |> where([candidate], candidate.id == ^article.id) |> Repo.one() do
      {:ok, canonical}
    else
      nil -> {:error, ArticlesErrorCat.not_exist("Article")}
      {:error, _} = error -> error
    end
  end

  defp scope_context(%{stage: :draft, branch_id: branch_id}, :doc) when not is_nil(branch_id),
    do: {:ok, :read_draft, DocScope.draft(branch_id, :owner_management)}

  defp scope_context(%{stage: :public, branch_id: branch_id}, :doc) when not is_nil(branch_id),
    do: {:ok, :read, DocScope.public_branch(branch_id)}

  defp scope_context(%{stage: :draft}, thread),
    do: {:ok, :read_draft, ArticleScope.draft(thread, :owner_management)}

  defp scope_context(%{stage: :public}, thread),
    do: {:ok, :read, ArticleScope.public(thread)}

  defp scope_context(_article, _thread),
    do: {:error, GroupherServer.ErrorCat.custom("invalid Activity Article scope")}

  defp maybe_branch(query, %{branch_id: branch_id}) when not is_nil(branch_id),
    do: where(query, [log], log.branch_ref == ^to_string(branch_id))

  defp maybe_branch(query, _article), do: query

  defp pagination(filter) when is_map(filter) do
    page = Map.get(filter, :page, 1)

    if Map.keys(filter) -- [:page] == [] and is_integer(page) and page > 0,
      do: {:ok, page},
      else: {:error, GroupherServer.Activity.ErrorCat.invalid_pagination()}
  end
end
