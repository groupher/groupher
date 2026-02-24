defmodule GroupherServer.CMS.Communities.Categories do
  @moduledoc """
  Category helpers for communities.
  """
  import GroupherServer.CMS.Articles.Write, only: [ensure_author_exists: 1]
  import ShortMaps

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Category, Community, CommunityCategory}
  alias Helper.ORM
  alias Helper.Types, as: T

  @spec create(map(), User.t()) :: T.domain_res(term())
  def create(attrs, %User{id: user_id}) do
    with {:ok, author} <- ensure_author_exists(%User{id: user_id}) do
      attrs = attrs |> Map.merge(%{author_id: author.id})
      Category |> ORM.create(attrs)
    end
  end

  @spec update(map()) :: T.domain_res(term())
  def update(~m(%Category id title)a) do
    with {:ok, category} <- ORM.find(Category, id) do
      category |> ORM.update(~m(title)a)
    end
  end

  @doc """
  set a category to community
  """
  @spec set(Community.t(), Category.t()) :: T.domain_res(term())
  def set(%Community{id: community_id}, %Category{id: category_id}) do
    with {:ok, community_category} <-
           CommunityCategory |> ORM.create(~m(community_id category_id)a) do
      Community |> ORM.find(community_category.community_id)
    end
  end

  @doc """
  unset a category to community
  """
  @spec unset(Community.t(), Category.t()) :: T.domain_res(term())
  def unset(%Community{id: community_id}, %Category{id: category_id}) do
    with {:ok, community_category} <-
           CommunityCategory |> ORM.findby_delete!(~m(community_id category_id)a) do
      Community |> ORM.find(community_category.community_id)
    end
  end
end
