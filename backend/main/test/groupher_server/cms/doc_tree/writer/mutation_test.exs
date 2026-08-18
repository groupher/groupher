defmodule GroupherServer.Test.CMS.DocTree.Writer.Mutation do
  @moduledoc false

  use GroupherServer.TestMate
  require CMS.Const

  import Ecto.Query, warn: false
  import GroupherServer.DataCase, only: [errors_on: 1]

  alias GroupherServer.Repo
  alias CMS.DocTree.Writer.Index

  alias CMS.Model.{
    DocBranch,
    Doc,
    DocsSiteState,
    DocTreeEvent,
    DocTreeNode
  }

  @plate_body Jason.encode!([
                %{"type" => "h1", "children" => [%{"text" => "Updated Draft"}]},
                %{"type" => "p", "children" => [%{"text" => "draft body"}]}
              ])

  describe "[doc tree draft writes]" do
    test "rejects a draft tree write when the Community is not writable" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, _blocker} =
        CMS.Communities.Lifecycle.apply_blocker(
          community.slug,
          %{blocker_type: :moderation_suspend, cause_code: "review_pending"},
          operation_ref: Ecto.UUID.generate()
        )

      assert {:error, %CMS.Gate.Decision{primary: %{reason: :ancestor_community_not_writable}}} =
               CMS.DocTree.create_group(community, %{
                 parent_node_id: root_doc_tab_node_id(community),
                 title: "Blocked guides",
                 slug: "blocked-guides",
                 base_revision: tree_state.tree_lock_version
               })
    end

    test "creating a page without doc_id creates a draft doc and bumps revisions" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)
      {:ok, before_site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_node_id: group_payload.node.id,
            title: "Install",
            slug: "install",
            base_revision: group_payload.revision
          },
          user
        )

      assert page_payload.node.type == :page
      assert page_payload.node.doc_id

      {:ok, doc_draft} = draft_doc(community, page_payload.node.doc_id)
      assert doc_draft.title == "Install"
      assert doc_draft.slug == "install"
      assert doc_draft.json == ~s([{"children":[{"text":""}],"type":"p"}])

      assert stage_count(DocTreeNode, community.id, :draft) == 3
      assert stage_count(Doc, community.id, :draft) == 1
      assert stage_count(DocTreeNode, community.id, :public) == 0
      assert stage_count(Doc, community.id, :public) == 0

      {:ok, tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)
      {:ok, site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      assert tree_state.tree_lock_version == before_tree_state.tree_lock_version + 2
      assert tree_state.staged_event_count == 1
      assert site_state.site_draft_version == before_site_state.site_draft_version + 2
      assert site_state.published_version == 0

      {:ok, tree} = CMS.DocTree.read(community)

      assert [%{owner: "tree", event_type: "node.create"}] = tree.staged_events

      doc_id = page_payload.node.doc_id

      assert %DocTreeEvent{owner: :doc, doc_id: ^doc_id} =
               doc_owned_create_event(community, page_payload.node.id)
    end

    test "creating a duplicate page uses copy title and slug for tree and draft" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, first_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_node_id: group_payload.node.id,
            title: "page-3",
            slug: "page-3",
            base_revision: group_payload.revision
          },
          user
        )

      {:ok, duplicate_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_node_id: group_payload.node.id,
            title: "page-3",
            slug: "page-3",
            base_revision: first_payload.revision
          },
          user
        )

      assert duplicate_payload.node.title == "page-3-copy"

      {:ok, doc_draft} = draft_doc(community, duplicate_payload.node.doc_id)
      assert doc_draft.title == "page-3-copy"
      assert doc_draft.slug == "page-3-copy"
      assert doc_draft.json == ~s([{"children":[{"text":""}],"type":"p"}])
    end

    test "trashed root group reserves its navigation title" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      assert {:ok, %{done: true}} = CMS.DocTree.publish_changes(community, %{}, user)
      {:ok, tree} = CMS.DocTree.read(community)

      {:ok, delete_payload} =
        CMS.DocTree.delete_node(community, group_payload.node.id, %{
          base_revision: tree.revision,
          actor_id: user.id
        })

      {:ok, rebuilt_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          slug: "guides",
          base_revision: delete_payload.revision
        })

      assert rebuilt_payload.node.title == "Guides 1"
    end

    test "trashed page reserves its sibling title and Doc slug" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_node_id: group_payload.node.id,
            title: "Install",
            slug: "install",
            base_revision: group_payload.revision
          },
          user
        )

      assert {:ok, %{done: true}} = CMS.DocTree.publish_changes(community, %{}, user)
      {:ok, tree} = CMS.DocTree.read(community)

      {:ok, delete_payload} =
        CMS.DocTree.delete_node(community, page_payload.node.id, %{
          base_revision: tree.revision,
          actor_id: user.id
        })

      {:ok, rebuilt_page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_node_id: group_payload.node.id,
            title: "Install",
            slug: "install",
            base_revision: delete_payload.revision
          },
          user
        )

      assert rebuilt_page_payload.node.title == "Install-copy"

      {:ok, doc_draft} = draft_doc(community, rebuilt_page_payload.node.doc_id)
      assert doc_draft.title == "Install-copy"
      assert doc_draft.slug == "install"
    end

    test "trashed group name blocks renaming another group into it" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, guides_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, api_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "API",
          slug: "api",
          base_revision: guides_payload.revision
        })

      assert {:ok, %{done: true}} = CMS.DocTree.publish_changes(community, %{}, user)
      {:ok, tree} = CMS.DocTree.read(community)

      {:ok, delete_payload} =
        CMS.DocTree.delete_node(community, guides_payload.node.id, %{
          base_revision: tree.revision,
          actor_id: user.id
        })

      assert {:error, {:custom, "A trashed tree item with this title is pending restore."}} =
               CMS.DocTree.update_node(community, api_payload.node.id, %{
                 title: "Guides",
                 slug: "guides",
                 base_revision: delete_payload.revision
               })
    end

    test "moving a page between groups normalizes indexes and records tree event" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, guides_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, api_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "API",
          slug: "api",
          base_revision: guides_payload.revision
        })

      {:ok, install_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_node_id: guides_payload.node.id,
            title: "Install",
            slug: "install",
            base_revision: api_payload.revision
          },
          user
        )

      {:ok, upgrade_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_node_id: guides_payload.node.id,
            title: "Upgrade",
            slug: "upgrade",
            base_revision: install_payload.revision
          },
          user
        )

      {:ok, move_payload} =
        CMS.DocTree.move_node(community, upgrade_payload.node.id, %{
          target_parent_node_id: api_payload.node.id,
          target_index: 0,
          base_revision: upgrade_payload.revision
        })

      {:ok, install_node} = draft_node(community, install_payload.node.id)
      {:ok, upgrade_node} = draft_node(community, upgrade_payload.node.id)

      assert install_node.parent_node_id == guides_payload.node.id
      assert install_node.index == 0
      assert upgrade_node.parent_node_id == api_payload.node.id
      assert upgrade_node.index == 0

      assert move_payload.affected_nodes |> Enum.map(& &1.id) |> Enum.sort() ==
               [install_payload.node.id, upgrade_payload.node.id] |> Enum.sort()

      {:ok, event} = tree_move_event(community, upgrade_payload.node.id)

      assert event.payload["beforeParentNodeId"] == guides_payload.node.id
      assert event.payload["afterParentNodeId"] == api_payload.node.id
      assert event.payload["beforeIndex"] == 1
      assert event.payload["afterIndex"] == 0
    end

    test "keeps nested groups before page and link siblings" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, parent} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          base_revision: state.tree_lock_version
        })

      {:ok, page} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_node_id: parent.node.id,
            title: "Install",
            base_revision: parent.revision
          },
          user
        )

      {:ok, link} =
        CMS.DocTree.create_link(community, %{
          parent_node_id: parent.node.id,
          title: "API",
          href: "https://example.com",
          base_revision: page.revision
        })

      {:ok, nested} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: parent.node.id,
          title: "Advanced",
          index: 0,
          base_revision: link.revision
        })

      siblings =
        DocTreeNode
        |> where([n], n.community_id == ^community.id)
        |> where([n], n.stage == :draft)
        |> where([n], n.parent_node_id == ^parent.node.id)
        |> order_by([n], asc: n.index)
        |> select([n], {n.type, n.title, n.index})
        |> Repo.all()

      assert siblings == [
               {:group, "Advanced", 0},
               {:page, "Install", 1},
               {:link, "API", 2}
             ]

      assert nested.node.index == 0
    end

    test "reindexes a large sibling lane with a constant number of UPDATE statements" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, parent} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          base_revision: state.tree_lock_version
        })

      {links, _revision} =
        Enum.reduce(1..12, {[], parent.revision}, fn number, {links, revision} ->
          {:ok, payload} =
            CMS.DocTree.create_link(community, %{
              parent_node_id: parent.node.id,
              title: "Link #{number}",
              href: "https://example.com/#{number}",
              base_revision: revision
            })

          {[payload.node | links], payload.revision}
        end)

      {:ok, node} = draft_node(community, hd(links).id)
      branch = Repo.get!(DocBranch, node.branch_id)

      {:ok, queries} =
        capture_repo_queries(fn ->
          Index.move_node(community, branch, node, parent.node.id, 0)
        end)

      assert doc_tree_update_query_count(queries) == 3

      siblings =
        DocTreeNode
        |> where([n], n.community_id == ^community.id)
        |> where([n], n.stage == :draft)
        |> where([n], n.parent_node_id == ^parent.node.id)
        |> order_by([n], asc: n.index)
        |> select([n], {n.node_id, n.index})
        |> Repo.all()

      assert Enum.map(siblings, &elem(&1, 1)) == Enum.to_list(0..11)
      assert hd(siblings) == {node.node_id, 0}
    end

    test "stale base_revision returns conflict and does not mutate draft tree" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, first_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "One",
          slug: "one",
          base_revision: tree_state.tree_lock_version
        })

      {:ok, conflict_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Two",
          slug: "two",
          base_revision: tree_state.tree_lock_version
        })

      assert first_payload.conflict == false
      assert conflict_payload.conflict == true
      assert conflict_payload.revision == first_payload.revision

      assert DocTreeNode
             |> where([n], n.community_id == ^community.id)
             |> where([n], n.stage == :draft)
             |> select([n], n.title)
             |> Repo.all()
             |> Enum.sort() == ["Introduction", "One"]
    end

    test "missing base_revision is rejected" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)

      assert {:error, {:custom, "base_revision is required"}} =
               CMS.DocTree.create_group(community, %{
                 parent_node_id: root_doc_tab_node_id(community),
                 title: "One",
                 slug: "one"
               })
    end

    test "creating a pin creates an independent top link node" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, pin_payload} =
        CMS.DocTree.create_pin(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "GitHub",
          slug: "github",
          href: "https://github.com/groupher/groupher",
          base_revision: before_tree_state.tree_lock_version
        })

      assert pin_payload.node.type == :pin
      assert pin_payload.node.parent_node_id == root_doc_tab_node_id(community)
      assert pin_payload.node.href == "https://github.com/groupher/groupher"

      {:ok, tree} = CMS.DocTree.read(community)

      assert [%{type: :pin, title: "GitHub", href: "https://github.com/groupher/groupher"}] =
               pins(tree)

      assert tree.tree_state.staged_event_count == 1
      assert Enum.map(tree.staged_events, & &1.event_type) == ["pin.add"]
    end

    test "reordering top groups does not change top pin indexes" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, first_group} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          slug: "guides",
          base_revision: state.tree_lock_version
        })

      {:ok, pin} =
        CMS.DocTree.create_pin(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "GitHub",
          slug: "github",
          href: "https://github.com/groupher/groupher",
          base_revision: first_group.revision
        })

      {:ok, second_group} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "API",
          slug: "api",
          base_revision: pin.revision
        })

      {:ok, _moved} =
        CMS.DocTree.move_node(community, second_group.node.id, %{
          target_parent_node_id: root_doc_tab_node_id(community),
          target_index: 0,
          base_revision: second_group.revision
        })

      {:ok, tree} = CMS.DocTree.read(community)

      assert Enum.map(groups(tree), &{&1.title, &1.index}) == [{"API", 0}, {"Guides", 1}]
      assert [%{title: "GitHub", index: 0}] = pins(tree)
    end

    test "page nodes can not be updated to remove doc draft reference" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_node_id: group_payload.node.id,
            title: "Install",
            slug: "install",
            base_revision: group_payload.revision
          },
          user
        )

      assert {:error, changeset} =
               CMS.DocTree.update_node(community, page_payload.node.id, %{
                 doc_id: nil,
                 base_revision: page_payload.revision
               })

      assert %{doc_id: ["page nodes require doc_id"]} =
               errors_on(changeset)
    end

    test "updating a doc draft stores parsed body payload and bumps site draft revision only" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)
      {:ok, before_site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_node_id: group_payload.node.id,
            title: "Install",
            slug: "install",
            base_revision: group_payload.revision
          },
          user
        )

      {:ok, current} =
        CMS.Articles.read_editor(community, :doc, page_payload.node.doc_id)

      {:ok, draft} =
        CMS.DocTree.update_draft(
          community,
          page_payload.node.doc_id,
          %{
            title: "Updated Install",
            slug: "updated-install",
            body_bag: mock_body_bag(@plate_body),
            expected_version: current.version
          },
          user
        )

      assert draft.title == "Updated Install"
      assert draft.slug == "updated-install"
      assert draft.json == @plate_body
      assert draft.digest =~ "Updated Draft"

      {:ok, page_node} =
        ORM.find_by(DocTreeNode,
          community_id: community.id,
          stage: :draft,
          node_id: page_payload.node.id
        )

      assert page_node.title == "Install"

      {:ok, tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)
      {:ok, site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      assert tree_state.tree_lock_version == group_payload.revision + 1
      assert site_state.site_draft_version == before_site_state.site_draft_version + 3
      assert site_state.published_version == 0
    end

    test "deleting mixed public and draft subtree discards stale staged creates" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, _page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_node_id: group_payload.node.id,
            title: "Install",
            slug: "install",
            base_revision: group_payload.revision
          },
          user
        )

      assert {:ok, %{done: true}} = CMS.DocTree.publish_changes(community, %{}, user)
      {:ok, tree} = CMS.DocTree.read(community)
      [group] = groups(tree)

      {:ok, link_payload} =
        CMS.DocTree.create_link(community, %{
          parent_node_id: group.id,
          title: "Draft Link",
          slug: "draft-link",
          href: "https://example.com",
          base_revision: tree.revision
        })

      {:ok, link_event} = tree_create_event(community, link_payload.node.id)
      assert link_event.status == CMS.Const.tree_event_status(:staged)

      assert {:ok, _delete_payload} =
               CMS.DocTree.delete_node(community, group.id, %{
                 base_revision: link_payload.revision,
                 actor_id: user.id
               })

      {:ok, link_event} = ORM.find(DocTreeEvent, link_event.id)
      assert link_event.status == CMS.Const.tree_event_status(:discarded)
      refute tree_delete_event_exists?(community, group.id)
    end
  end

  defp empty_docs_community(user), do: create_empty_docs_community(user)

  defp stage_count(schema, community_id, stage) do
    schema
    |> where([item], item.community_id == ^community_id)
    |> where([item], item.stage == ^stage)
    |> Repo.aggregate(:count, :id)
  end

  defp draft_node(community, node_id) do
    ORM.find_by(DocTreeNode,
      community_id: community.id,
      stage: CMS.Const.stage(:draft),
      node_id: node_id
    )
  end

  defp doc_owned_create_event(community, node_id) do
    doc_owner = CMS.Const.tree_event_owner(:doc)
    node_create = CMS.Const.tree_event(:node_create)

    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.owner == ^doc_owner)
    |> where([e], e.event_type == ^node_create)
    |> where([e], e.node_id == ^node_id)
    |> Repo.one()
  end

  defp draft_doc(community, doc_id) do
    ORM.find_by(Doc,
      community_id: community.id,
      article_hash_id: doc_id,
      stage: CMS.Const.stage(:draft)
    )
  end

  defp tree_create_event(community, node_id) do
    tree_owner = CMS.Const.tree_event_owner(:tree)
    node_create = CMS.Const.tree_event(:node_create)

    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.owner == ^tree_owner)
    |> where([e], e.event_type == ^node_create)
    |> where([e], e.node_id == ^node_id)
    |> Repo.one()
    |> case do
      %DocTreeEvent{} = event -> {:ok, event}
      nil -> {:error, {:custom, "Tree create event not found."}}
    end
  end

  defp tree_move_event(community, node_id) do
    tree_owner = CMS.Const.tree_event_owner(:tree)
    node_move = CMS.Const.tree_event(:node_move)

    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.owner == ^tree_owner)
    |> where([e], e.event_type == ^node_move)
    |> where([e], e.node_id == ^node_id)
    |> Repo.one()
    |> case do
      %DocTreeEvent{} = event -> {:ok, event}
      nil -> {:error, {:custom, "Tree move event not found."}}
    end
  end

  defp tree_delete_event_exists?(community, node_id) do
    tree_owner = CMS.Const.tree_event_owner(:tree)
    staged = CMS.Const.tree_event_status(:staged)
    node_delete = CMS.Const.tree_event(:node_delete)

    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.owner == ^tree_owner)
    |> where([e], e.status == ^staged)
    |> where([e], e.event_type == ^node_delete)
    |> where([e], e.node_id == ^node_id)
    |> Repo.exists?()
  end

  defp capture_repo_queries(fun) do
    ref = make_ref()
    handler_id = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, _measurements, metadata, {pid, query_ref} ->
          send(pid, {query_ref, metadata.query})
        end,
        {self(), ref}
      )

    try do
      result = fun.()
      {result, drain_queries(ref, [])}
    after
      :telemetry.detach(handler_id)
    end
  end

  defp drain_queries(ref, queries) do
    receive do
      {^ref, query} -> drain_queries(ref, [query | queries])
    after
      0 -> Enum.reverse(queries)
    end
  end

  defp doc_tree_update_query_count(queries) do
    Enum.count(queries, fn query ->
      query
      |> String.trim_leading()
      |> String.match?(~r/^UPDATE (?:(?:"cms"|cms)\.)?"?doc_tree_nodes"?/)
    end)
  end

  defp groups(%{tabs: [tab | _]}), do: tab.groups
  defp pins(%{tabs: [tab | _]}), do: tab.pins
end
