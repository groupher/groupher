defmodule GroupherServer.CMS.Comments.Numbering do
  @moduledoc """
  Allocates per-article comment public numbers.
  """

  alias Helper.{ORM, T}

  @spec next_floor(map(), atom()) :: T.domain_res(integer())
  def next_floor(article, _foreign_key) do
    case ORM.inc_meta(article, :next_floor) do
      {:ok, _updated_article, new_floor} -> {:ok, new_floor}
      {:error, reason} -> {:error, reason}
    end
  end

  @spec next_inner_id(map(), atom()) :: T.domain_res(integer())
  def next_inner_id(article, _foreign_key) do
    case ORM.inc_meta(article, :next_comment_inner_id) do
      {:ok, _updated_article, new_inner_id} -> {:ok, new_inner_id}
      {:error, reason} -> {:error, reason}
    end
  end
end
