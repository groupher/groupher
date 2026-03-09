defmodule GroupherServer.Test.CMS.Communities.Count.UpdateInnerId do
  @moduledoc false
  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, ~m(user community)a}
  end

  describe "[update_inner_id]" do
    test "update post inner_id index", ~m(community)a do
      {:ok, community} = ORM.fill_meta(community)
      _initial_index = community.meta.posts_inner_id_index

      {:ok, updated_community} =
        CMS.Communities.update_inner_id(
          community,
          :post,
          %{inner_id: 100}
        )

      {:ok, updated_community} = ORM.fill_meta(updated_community)
      assert updated_community.meta.posts_inner_id_index == 100
    end

    test "update blog inner_id index", ~m(community)a do
      {:ok, community} = ORM.fill_meta(community)

      {:ok, updated_community} =
        CMS.Communities.update_inner_id(
          community,
          :blog,
          %{inner_id: 50}
        )

      {:ok, updated_community} = ORM.fill_meta(updated_community)
      assert updated_community.meta.blogs_inner_id_index == 50
    end

    test "update changelog inner_id index", ~m(community)a do
      {:ok, community} = ORM.fill_meta(community)

      {:ok, updated_community} =
        CMS.Communities.update_inner_id(
          community,
          :changelog,
          %{inner_id: 25}
        )

      {:ok, updated_community} = ORM.fill_meta(updated_community)
      assert updated_community.meta.changelogs_inner_id_index == 25
    end

    test "update doc inner_id index", ~m(community)a do
      {:ok, community} = ORM.fill_meta(community)

      {:ok, updated_community} =
        CMS.Communities.update_inner_id(
          community,
          :doc,
          %{inner_id: 10}
        )

      {:ok, updated_community} = ORM.fill_meta(updated_community)
      assert updated_community.meta.docs_inner_id_index == 10
    end
  end
end
