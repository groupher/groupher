defmodule GroupherServer.Activity.ArticleLog do
  @moduledoc """
  Reads an Article's permission-aware public ArticleLog surface.

      Article read scope -> contract-visible action subset -> safe projection
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Activity, CMS}

  alias Activity.Artiment
  alias CMS.Gate
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

  defp authorize_read(
         %{stage: :draft, article_id: article_id, branch_id: branch_id, thread: :doc},
         actor
       ) do
    Gate.Access.access_check(actor, :edit, %{
      id: article_id,
      thread: :doc,
      branch_id: branch_id
    })
  end

  defp authorize_read(%{article_id: article_id, branch_id: branch_id}, actor)
       when is_binary(article_id) and is_integer(branch_id) do
    Gate.Access.access_check(actor, :read, %{
      id: article_id,
      thread: :doc,
      branch_id: branch_id
    })
  end

  defp authorize_read(article, actor) do
    Gate.Access.access_check(actor, :read, article)
  end

  defp maybe_branch(query, %{branch_id: branch_id}) when not is_nil(branch_id),
    do: where(query, [log], log.branch_id == ^branch_id)

  defp maybe_branch(query, _article), do: query

  defp pagination(filter) when is_map(filter) do
    page = Map.get(filter, :page, 1)

    if Map.keys(filter) -- [:page] == [] and is_integer(page) and page > 0,
      do: {:ok, page},
      else: {:error, GroupherServer.Activity.ErrorCat.invalid_pagination()}
  end
end
