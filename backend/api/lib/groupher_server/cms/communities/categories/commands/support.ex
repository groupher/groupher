defmodule GroupherServer.CMS.Communities.Categories.Commands.Support do
  @moduledoc """
  Shared target loading and result builders for Category Commands.

      Category Command -> Support -> FrontDesk / Repo -> canonical result
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Communities.ErrorCat
  alias CMS.FrontDesk
  alias CMS.Model.{Category, Community}

  @doc false
  def community(%Community{} = community), do: {:ok, community}
  def community(ref), do: FrontDesk.community(ref, mode: :internal)

  @doc false
  def category(id) do
    case Repo.get(Category, id) do
      %Category{} = category -> {:ok, category}
      nil -> {:error, ErrorCat.not_exist("Category")}
    end
  end

  @doc false
  def category_result(%{data: %{"category_id" => id}}) do
    case Repo.get(Category, id) do
      %Category{} = category -> {:ok, category}
      nil -> {:ok, %Category{id: id}}
    end
  end

  def category_result(_), do: {:error, CMS.ErrorCat.command_result_unavailable()}

  @doc false
  def community_result(%{data: %{"community_id" => id}}) do
    case Repo.get(Community, id) do
      %Community{} = community -> {:ok, community}
      nil -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  def community_result(_), do: {:error, CMS.ErrorCat.command_result_unavailable()}

  @doc false
  def confirmation(module, key, value, command_id),
    do: struct(module, data: %{key => value, "command_id" => command_id})
end
