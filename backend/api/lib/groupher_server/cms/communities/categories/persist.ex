defmodule GroupherServer.CMS.Communities.Categories.Persist do
  @moduledoc """
  Caller-owned persistence primitives for Community Categories.

      Category Command
        -> community Gate / transaction owner
        -> Categories.Persist
        -> Category / CommunityCategory rows
  """

  import ShortMaps

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Category, Community, CommunityCategory}
  alias Helper.{ORM, T}

  @doc "Inserts one Category for an already admitted Community owner."
  @spec insert_category(map(), Community.t(), integer()) :: T.domain_res(Category.t())
  def insert_category(attrs, %Community{} = _community, author_id) when is_map(attrs) do
    %Category{}
    |> Category.changeset(Map.merge(attrs, %{author_id: author_id}))
    |> Repo.insert()
  end

  @doc "Updates one Category after the caller has checked its Community scope."
  @spec update_category(Category.t(), map()) :: T.domain_res(Category.t())
  def update_category(%Category{} = category, attrs) when is_map(attrs),
    do: ORM.update(category, attrs)

  @doc "Deletes one Category after the caller has checked its Community scope."
  @spec delete_category(Category.t()) :: T.domain_res(Category.t())
  def delete_category(%Category{} = category), do: ORM.delete(category)

  @doc "Creates one CommunityCategory association."
  @spec set_category(Community.t(), Category.t()) :: T.domain_res(CommunityCategory.t())
  def set_category(%Community{id: community_id}, %Category{id: category_id}) do
    CommunityCategory
    |> ORM.insert_or_ignore(
      ~m(community_id category_id)a,
      conflict_target: [:community_id, :category_id]
    )
  end

  @doc "Deletes one CommunityCategory association."
  @spec unset_category(Community.t(), Category.t()) :: T.domain_res(CommunityCategory.t())
  def unset_category(%Community{id: community_id}, %Category{id: category_id}) do
    CommunityCategory |> ORM.findby_delete(~m(community_id category_id)a)
  end

  @doc "Returns whether a Category belongs to the admitted Community."
  @spec category_in_community?(Community.t(), Category.t() | integer()) :: boolean()
  def category_in_community?(%Community{id: community_id}, %Category{id: category_id}),
    do: category_in_community?(%Community{id: community_id}, category_id)

  def category_in_community?(%Community{id: community_id}, category_id) do
    match?(
      {:ok, _},
      ORM.find_by(CommunityCategory, community_id: community_id, category_id: category_id)
    )
  end
end
