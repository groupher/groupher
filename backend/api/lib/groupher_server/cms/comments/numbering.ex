defmodule GroupherServer.CMS.Comments.Numbering do
  @moduledoc """
  Allocates per-article comment public numbers.

  Business position:

      Client
        -> GraphQL
        -> CMS.Comments
        -> Numbering
        -> Repo / domain event
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Article
  alias Helper.T

  @doc """
  Allocates the next comment floor for an article.

  Atomically increments the article meta `:next_floor` counter and returns the
  new floor value.

  ## Examples

      CMS.Comments.Numbering.next_floor(article, :post_id)

  """
  @spec next_floor(map(), atom()) :: T.domain_res(integer())
  def next_floor(%Article{id: article_id}, _foreign_key) do
    allocate(article_id, :next_floor)
  end

  @doc "Allocates the next public comment identifier for a stable article."
  @spec next_inner_id(map(), atom()) :: T.domain_res(integer())
  def next_inner_id(%Article{id: article_id}, _foreign_key) do
    allocate(article_id, :next_comment_inner_id)
  end

  defp allocate(article_id, field) do
    case Article
         |> where([article], article.id == ^article_id)
         |> select([article], %{value: field(article, ^field)})
         |> Repo.update_all(inc: [{field, 1}]) do
      {1, [%{value: value}]} -> {:ok, value - 1}
      _ -> {:error, CMS.ErrorCat.custom(%{reason: :article_counter_not_updated})}
    end
  end
end
