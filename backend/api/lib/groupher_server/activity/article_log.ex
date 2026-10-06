defmodule GroupherServer.Activity.ArticleLog do
  @moduledoc """
  Reads an Article's permission-aware public ArticleLog surface.

      Article read scope -> contract-visible action subset -> safe projection
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Activity, CMS, Repo}

  alias Activity.Artiment
  alias Activity.ErrorCat, as: ActivityErrorCat
  alias CMS.Articles.ErrorCat, as: ArticlesErrorCat
  alias CMS.Gate
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Model.{Article, ArticleDraft}
  alias Helper.ORM

  @page_size 20

  @doc "Lists the permission-filtered Activity surface for one Article or Doc branch."
  @spec list(struct(), struct() | nil, map()) :: {:ok, map()} | {:error, term()}
  def list(article, actor, filter) do
    with {:ok, canonical} <- authorize_read(article, actor),
         {:ok, handler} <- Artiment.handler(canonical),
         {:ok, page} <- pagination(filter) do
      actions = handler.surface_actions(:article_log)
      article_id = canonical.id

      query =
        handler.schema()
        |> where([log], field(log, ^handler.stream_field()) == ^article_id)
        |> where([log], log.action in ^actions)
        |> maybe_branch(article)
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

  defp authorize_read(%ArticleDraft{article_id: article_id}, actor) do
    case Repo.get(Article, article_id) do
      %Article{thread: thread} ->
        authorize_scoped(
          article_id,
          actor,
          :read_draft,
          ArticleContext.draft(thread, :owner_management)
        )

      nil ->
        {:error, ArticlesErrorCat.not_exist("Article")}
    end
  end

  defp authorize_read(article, actor) do
    with thread when is_atom(thread) <- Map.get(article, :thread),
         article_id when is_binary(article_id) <-
           Map.get(article, :article_id) || Map.get(article, :id),
         {:ok, action, context} <- scope_context(article, thread) do
      authorize_scoped(article_id, actor, action, context)
    else
      {:error, _reason} = error -> error
      _ -> {:error, ActivityErrorCat.custom("invalid Activity Article scope")}
    end
  end

  defp authorize_scoped(article_id, actor, action, context) do
    with %Ecto.Query{} = query <- Gate.scope(Article, actor, action, context),
         %Article{} = canonical <-
           query |> where([candidate], candidate.id == ^article_id) |> Repo.one() do
      {:ok, canonical}
    else
      nil -> {:error, ArticlesErrorCat.not_exist("Article")}
      {:error, _reason} = error -> error
    end
  end

  defp scope_context(%{stage: :draft, branch_id: branch_id}, :doc)
       when is_integer(branch_id) do
    {:ok, :read_draft, DocContext.draft(branch_id, :owner_management)}
  end

  defp scope_context(%{stage: :public, branch_id: branch_id}, :doc)
       when is_integer(branch_id) do
    {:ok, :read, DocContext.public_branch(branch_id)}
  end

  defp scope_context(%{stage: :draft}, thread) do
    {:ok, :read_draft, ArticleContext.draft(thread, :owner_management)}
  end

  defp scope_context(%{stage: :public}, thread) do
    {:ok, :read, ArticleContext.public(thread)}
  end

  defp scope_context(_article, _thread) do
    {:error, ActivityErrorCat.custom("invalid Activity Article scope")}
  end

  defp maybe_branch(query, %{branch_id: branch_id}) when not is_nil(branch_id) do
    where(query, [log], log.branch_id == ^branch_id)
  end

  defp maybe_branch(query, _article), do: query

  defp pagination(filter) when is_map(filter) do
    page = Map.get(filter, :page, 1)

    if Map.keys(filter) -- [:page] == [] and is_integer(page) and page > 0 do
      {:ok, page}
    else
      {:error, GroupherServer.Activity.ErrorCat.invalid_pagination()}
    end
  end
end
