defmodule GroupherServer.Test.CMS.DocTree.NestedGroup do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.{Doc, DocsSiteState}

  require CMS.Const

  describe "recursive docs navigation" do
    setup do
      {:ok, user} = db_insert(:user)
      community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})
      {:ok, community} = CMS.Communities.create(community_attrs, user)
      {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, tab} =
        CMS.DocTree.create_node(community, %{
          type: :tab,
          title: "Docs",
          base_revision: state.tree_lock_version
        })

      {:ok, guide} =
        CMS.DocTree.create_node(community, %{
          type: :group,
          parent_node_id: tab.node.id,
          title: "Guide",
          base_revision: tab.revision
        })

      {:ok, advanced} =
        CMS.DocTree.create_node(community, %{
          type: :group,
          parent_node_id: guide.node.id,
          title: "Advanced",
          base_revision: guide.revision
        })

      {:ok, page} =
        CMS.DocTree.create_node(
          community,
          %{
            type: :page,
            parent_node_id: advanced.node.id,
            title: "Install",
            base_revision: advanced.revision
          },
          user
        )

      {:ok, ~m(user community tab guide advanced page)a}
    end

    test "reads arbitrary-depth pages and rejects cycles", context do
      ~m(user community tab guide advanced page)a = context

      assert {:ok, tree} = CMS.DocTree.read(community)
      [tab_node] = tree.tabs
      [guide_node] = tab_node.groups
      [advanced_node] = guide_node.pages
      [page_node] = advanced_node.pages

      assert tab_node.id == tab.node.id
      assert guide_node.id == guide.node.id
      assert advanced_node.id == advanced.node.id
      assert page_node.id == page.node.id
      assert page_node.type == :page

      assert {:error, %GroupherServer.ErrorCat.Error{reason: :custom, details: message}} =
               CMS.DocTree.move_node(community, guide.node.id, %{
                 target_parent_node_id: advanced.node.id,
                 target_index: 0,
                 base_revision: page.revision
               })

      assert message =~ "descendant"

      assert {:error, %GroupherServer.ErrorCat.Error{reason: :custom, details: parent_message}} =
               CMS.DocTree.create_node(
                 community,
                 %{
                   type: :page,
                   parent_node_id: tab.node.id,
                   title: "Invalid root page",
                   base_revision: page.revision
                 },
                 user
               )

      assert parent_message =~ "parents must be a group"
    end

    test "duplicates a complete Group subtree and its Page content", context do
      ~m(user community guide page)a = context

      assert {:ok, duplicated} =
               CMS.DocTree.duplicate_node(community, guide.node.id, %{
                 actor_id: user.id,
                 base_revision: page.revision
               })

      assert duplicated.node.type == :group
      assert duplicated.node.title == "Guide copy"

      {:ok, tree} = CMS.DocTree.read(community)
      [tab] = tree.tabs
      duplicated_group = Enum.find(tab.groups, &(&1.id == duplicated.node.id))

      [duplicated_advanced] = duplicated_group.pages
      [duplicated_page] = duplicated_advanced.pages
      duplicated_doc_id = duplicated_page.doc_id

      assert duplicated_advanced.type == :group
      assert duplicated_advanced.title == "Advanced"
      assert duplicated_page.type == :page
      assert duplicated_page.title == "Install"

      refute duplicated_doc_id == page.node.doc_id

      assert {:ok, %Doc{title: "Install"}} =
               ORM.find_by(Doc,
                 community_id: community.id,
                 article_hash_id: duplicated_doc_id,
                 stage: CMS.Const.stage(:draft)
               )
    end

    test "accepts depth 32 and rejects deeper creates and subtree moves", context do
      ~m(community tab advanced page)a = context
      max_depth = CMS.Const.doc_tree_max_depth()

      {deepest_node_id, revision, nodes_by_depth} =
        Enum.reduce(3..max_depth, {advanced.node.id, page.revision, %{}}, fn depth,
                                                                             {parent_node_id,
                                                                              revision, nodes} ->
          assert {:ok, created} =
                   CMS.DocTree.create_node(community, %{
                     type: :group,
                     parent_node_id: parent_node_id,
                     title: "Depth #{depth}",
                     base_revision: revision
                   })

          {created.node.id, created.revision, Map.put(nodes, depth, created.node.id)}
        end)

      assert {:error, %GroupherServer.ErrorCat.Error{reason: :custom, details: create_message}} =
               CMS.DocTree.create_node(community, %{
                 type: :group,
                 parent_node_id: deepest_node_id,
                 title: "Too deep",
                 base_revision: revision
               })

      assert create_message =~ "maximum depth of #{max_depth}"

      assert {:ok, movable} =
               CMS.DocTree.create_node(community, %{
                 type: :group,
                 parent_node_id: tab.node.id,
                 title: "Movable",
                 base_revision: revision
               })

      assert {:ok, movable_child} =
               CMS.DocTree.create_node(community, %{
                 type: :group,
                 parent_node_id: movable.node.id,
                 title: "Movable child",
                 base_revision: movable.revision
               })

      assert {:error, %GroupherServer.ErrorCat.Error{reason: :custom, details: move_message}} =
               CMS.DocTree.move_node(community, movable.node.id, %{
                 target_parent_node_id: Map.fetch!(nodes_by_depth, max_depth - 1),
                 target_index: 0,
                 base_revision: movable_child.revision
               })

      assert move_message =~ "maximum depth of #{max_depth}"
    end
  end
end
