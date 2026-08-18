defmodule GroupherServer.Test.CMS.DocTree.Tabs do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.DocsSiteState

  describe "[doc tree tabs]" do
    test "creates an empty independent tab and allows deleting the last tab" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = create_community(user)
      {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, payload} =
        CMS.DocTree.create_tab(community, %{
          title: "API",
          base_revision: state.tree_lock_version
        })

      assert payload.node.type == :tab
      assert payload.affected_nodes == []

      {:ok, tree} = CMS.DocTree.read(community)
      assert [%{title: "API"}] = tree.tabs

      assert {:ok, _payload} =
               CMS.DocTree.delete_node(community, tree.tabs |> hd() |> Map.fetch!(:id), %{
                 base_revision: tree.revision,
                 actor_id: user.id
               })

      assert {:ok, %{tabs: []}} = CMS.DocTree.read(community)
    end

    test "tree publish omits an empty tab until it owns publishable navigation" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = create_community(user)
      {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, payload} =
        CMS.DocTree.create_tab(community, %{
          title: "API",
          base_revision: state.tree_lock_version
        })

      assert payload.affected_nodes == []

      assert {:ok, %{done: true}} = CMS.DocTree.publish_changes(community, %{}, user)

      assert {:ok, %{tabs: []}} = CMS.DocTree.read_public(community)
    end

    test "public tree read is hidden after the Community is suspended" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = create_community(user)

      {:ok, _blocker} =
        CMS.Communities.Lifecycle.apply_blocker(
          community.slug,
          %{blocker_type: :moderation_suspend, cause_code: "review_pending"},
          operation_ref: Ecto.UUID.generate()
        )

      assert {:error, {:not_exist, "Community"}} = CMS.DocTree.read_public(community)
    end

    test "renames and reorders tabs through the generic tree mutations" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = create_community(user)
      {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, first} =
        CMS.DocTree.create_tab(community, %{
          title: "Introduction",
          base_revision: state.tree_lock_version
        })

      {:ok, created} =
        CMS.DocTree.create_tab(community, %{
          title: "API",
          base_revision: first.revision
        })

      {:ok, renamed} =
        CMS.DocTree.update_node(community, created.node.id, %{
          title: "Guides",
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
