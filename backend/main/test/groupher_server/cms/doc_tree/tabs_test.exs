defmodule GroupherServer.Test.CMS.DocTree.Tabs do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.DocsSiteState

  describe "[doc tree tabs]" do
    test "creates an independent tab with its initial group and keeps one tab" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = create_community(user)
      {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, payload} =
        CMS.DocTree.create_tab(community, %{
          title: "API",
          slug: "api",
          base_revision: state.tree_lock_version
        })

      assert payload.node.type == :tab
      assert [%{type: :group, title: "Untitled", tab_id: tab_id}] = payload.affected_nodes
      assert tab_id == payload.node.id

      {:ok, tree} = CMS.DocTree.read(community)
      assert Enum.map(tree.tabs, & &1.title) == ["Introduction", "API"]

      {:ok, _} =
        CMS.DocTree.delete_node(community, tree.tabs |> hd() |> Map.fetch!(:id), %{
          base_revision: payload.revision,
          actor_id: user.id
        })

      {:ok, tree} = CMS.DocTree.read(community)
      assert [%{title: "API"}] = tree.tabs

      assert {:error, {:custom, "the last docs tab can not be deleted"}} =
               CMS.DocTree.delete_node(community, tree.tabs |> hd() |> Map.fetch!(:id), %{
                 base_revision: tree.revision,
                 actor_id: user.id
               })
    end

    test "published empty tab remains visible on the public tree" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = create_community(user)
      {:ok, _} = CMS.DocTree.delete_demo_template(community)
      {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, payload} =
        CMS.DocTree.create_tab(community, %{
          title: "API",
          slug: "api",
          base_revision: state.tree_lock_version
        })

      assert [
               %{type: :tab, title: "Introduction", index: 0},
               %{type: :group, title: "Untitled"}
             ] = payload.affected_nodes

      assert {:ok, %{done: true}} = CMS.DocTree.publish_changes(community, %{}, user)

      assert {:ok,
              %{
                tabs: [
                  %{title: "Introduction", groups: []},
                  %{title: "API", groups: [%{title: "Untitled"}]}
                ]
              }} =
               CMS.DocTree.read_public(community)
    end

    test "renames and reorders tabs through the generic tree mutations" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = create_community(user)
      {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, created} =
        CMS.DocTree.create_tab(community, %{
          title: "API",
          slug: "api",
          base_revision: state.tree_lock_version
        })

      {:ok, renamed} =
        CMS.DocTree.update_node(community, created.node.id, %{
          title: "Guides",
          slug: "guides",
          base_revision: created.revision
        })

      {:ok, moved} =
        CMS.DocTree.move_node(community, created.node.id, %{
          target_index: 0,
          base_revision: renamed.revision
        })

      assert Enum.map(moved.affected_nodes, &{&1.title, &1.index}) == [
               {"Guides", 0},
               {"Introduction", 1}
             ]

      assert {:ok, %{tabs: [%{title: "Guides"}, %{title: "Introduction"}]}} =
               CMS.DocTree.read(community)
    end
  end

  defp create_community(user) do
    mock_attrs(:community)
    |> Map.put(:user, user)
    |> CMS.Communities.create(user)
  end
end
