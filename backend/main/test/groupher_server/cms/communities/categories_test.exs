defmodule GroupherServer.Test.CMS.Communities.Categories do
  @moduledoc false
  use GroupherServer.TestTools

  alias CMS.Model.Category

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    {:ok, category} = db_insert(:category)

    {:ok, ~m(user community category)a}
  end

  describe "[cms category]" do
    test "create category with valid attrs", ~m(user)a do
      valid_attrs = mock_attrs(:category, %{user_id: user.id})
      ~m(title slug)a = valid_attrs

      {:ok, category} = CMS.Communities.create_category(~m(title slug)a, user)

      assert category.title == valid_attrs.title
    end

    test "create category with same title fails", ~m(user)a do
      valid_attrs = mock_attrs(:category, %{user_id: user.id})
      ~m(title slug)a = valid_attrs

      assert {:ok, _} = CMS.Communities.create_category(~m(title slug)a, user)
      assert {:error, _} = CMS.Communities.create_category(~m(title)a, user)
    end

    test "update category with valid attrs", ~m(user)a do
      valid_attrs = mock_attrs(:category, %{user_id: user.id})
      ~m(title slug)a = valid_attrs

      {:ok, category} = CMS.Communities.create_category(~m(title slug)a, user)

      assert category.title == valid_attrs.title

      {:ok, updated} =
        CMS.Communities.update_category(%Category{id: category.id, title: "new title"})

      assert updated.title == "new title"
    end

    test "update title to existing title fails", ~m(user)a do
      valid_attrs = mock_attrs(:category, %{user_id: user.id})
      ~m(title slug)a = valid_attrs

      {:ok, category} = CMS.Communities.create_category(~m(title slug)a, user)

      new_category_attrs = %{title: "category2 title", slug: "category2 title"}
      {:ok, category2} = CMS.Communities.create_category(new_category_attrs, user)

      {:error, _} =
        CMS.Communities.update_category(%Category{id: category.id, title: category2.title})
    end

    test "can set a category to a community", ~m(community category)a do
      {:ok, _} = CMS.Communities.set_category(community, category)

      {:ok, found_community} = ORM.find(Community, community.id, preload: :categories)
      {:ok, found_category} = ORM.find(Category, category.id, preload: :communities)

      assoc_categories = found_community.categories |> Enum.map(& &1.id)
      assoc_communities = found_category.communities |> Enum.map(& &1.id)

      assert category.id in assoc_categories
      assert community.id in assoc_communities
    end

    test "can unset a category to a community", ~m(community category)a do
      {:ok, _} = CMS.Communities.set_category(community, category)
      CMS.Communities.unset_category(community, category)

      {:ok, found_community} = ORM.find(Community, community.id, preload: :categories)
      {:ok, found_category} = ORM.find(Category, category.id, preload: :communities)

      assoc_categories = found_community.categories |> Enum.map(& &1.id)
      assoc_communities = found_category.communities |> Enum.map(& &1.id)

      assert category.id not in assoc_categories
      assert community.id not in assoc_communities
    end
  end
end
