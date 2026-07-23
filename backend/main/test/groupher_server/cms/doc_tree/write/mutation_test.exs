defmodule GroupherServer.Test.CMS.DocTree.Write.Mutation do
  @moduledoc false

  use GroupherServer.TestMate
  require CMS.Const

  import Ecto.Query, warn: false
  import GroupherServer.DataCase, only: [errors_on: 1]

  alias GroupherServer.Repo

  alias CMS.Model.{
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
    test "creating a page without doc_id creates a draft doc and bumps revisions" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)
      {:ok, before_site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            group_id: group_payload.node.id,
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
      assert doc_draft.json =~ "Start writing your docs draft here."

      assert stage_count(DocTreeNode, community.id, :draft) == 3
      assert stage_count(Doc, community.id, :draft) == 1
      assert stage_count(DocTreeNode, community.id, :public) == 0
      assert stage_count(Doc, community.id, :public) == 0

      {:ok, tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)
      {:ok, site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      assert tree_state.tree_lock_version == before_tree_state.tree_lock_version + 2
      assert tree_state.staged_event_count == 2
      assert site_state.site_draft_version == before_site_state.site_draft_version + 2
      assert site_state.published_version == 0

      {:ok, tree} = CMS.DocTree.read(community)

      assert [
               %{owner: "tree", event_type: "node.create"},
               %{owner: "tree", event_type: "node.create"}
             ] = tree.staged_events

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
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, first_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            group_id: group_payload.node.id,
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
            group_id: group_payload.node.id,
            title: "page-3",
            slug: "page-3",
            base_revision: first_payload.revision
          },
          user
        )

      assert duplicate_payload.node.title == "page-3-copy"
      assert duplicate_payload.node.slug == "page-3-copy"

      {:ok, doc_draft} = draft_doc(community, duplicate_payload.node.doc_id)
      assert doc_draft.title == "page-3-copy"
      assert doc_draft.slug == "page-3-copy"
      assert doc_draft.json =~ "Start writing your docs draft here."
    end

    test "trashed root group reserves its title and slug" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
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
          title: "Guides",
          slug: "guides",
          base_revision: delete_payload.revision
        })

      assert rebuilt_payload.node.title == "Guides 1"
      assert rebuilt_payload.node.slug == "guides-1"
    end

    test "trashed page reserves its sibling title and slug" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            group_id: group_payload.node.id,
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
            group_id: group_payload.node.id,
            title: "Install",
            slug: "install",
            base_revision: delete_payload.revision
          },
          user
        )

      assert rebuilt_page_payload.node.title == "Install-copy"
      assert rebuilt_page_payload.node.slug == "install-copy"

      {:ok, doc_draft} = draft_doc(community, rebuilt_page_payload.node.doc_id)
      assert doc_draft.title == "Install-copy"
      assert doc_draft.slug == "install-copy"
    end

    test "trashed group name blocks renaming another group into it" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, guides_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, api_payload} =
        CMS.DocTree.create_group(community, %{
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

      assert {:error,
              {:custom, "A trashed tree item with this title or slug is pending restore."}} =
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
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, api_payload} =
        CMS.DocTree.create_group(community, %{
          title: "API",
          slug: "api",
          base_revision: guides_payload.revision
        })

      {:ok, install_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            group_id: guides_payload.node.id,
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
            group_id: guides_payload.node.id,
            title: "Upgrade",
            slug: "upgrade",
            base_revision: install_payload.revision
          },
          user
        )

      {:ok, move_payload} =
        CMS.DocTree.move_node(community, upgrade_payload.node.id, %{
          target_group_id: api_payload.node.id,
          target_index: 0,
          base_revision: upgrade_payload.revision
        })

      {:ok, install_node} = draft_node(community, install_payload.node.id)
      {:ok, upgrade_node} = draft_node(community, upgrade_payload.node.id)

      assert install_node.group_id == guides_payload.node.id
      assert install_node.index == 0
      assert upgrade_node.group_id == api_payload.node.id
      assert upgrade_node.index == 0

      assert move_payload.affected_nodes |> Enum.map(& &1.id) |> Enum.sort() ==
               [install_payload.node.id, upgrade_payload.node.id] |> Enum.sort()

      {:ok, event} = tree_move_event(community, upgrade_payload.node.id)

      assert event.payload["beforeGroupId"] == guides_payload.node.id
      assert event.payload["afterGroupId"] == api_payload.node.id
      assert event.payload["beforeIndex"] == 1
      assert event.payload["afterIndex"] == 0
    end

    test "stale base_revision returns conflict and does not mutate draft tree" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, first_payload} =
        CMS.DocTree.create_group(community, %{
          title: "One",
          slug: "one",
          base_revision: tree_state.tree_lock_version
        })

      {:ok, conflict_payload} =
        CMS.DocTree.create_group(community, %{
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
          title: "GitHub",
          slug: "github",
          href: "https://github.com/groupher/groupher",
          base_revision: before_tree_state.tree_lock_version
        })

      assert pin_payload.node.type == :pin
      assert pin_payload.node.group_id == nil
      assert pin_payload.node.href == "https://github.com/groupher/groupher"

      {:ok, tree} = CMS.DocTree.read(community)

      assert [%{type: :pin, title: "GitHub", href: "https://github.com/groupher/groupher"}] =
               pins(tree)

      assert tree.tree_state.staged_event_count == 2
      assert Enum.map(tree.staged_events, & &1.event_type) == ["node.create", "pin.add"]
    end

    test "reordering top groups does not change top pin indexes" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, first_group} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: state.tree_lock_version
        })

      {:ok, pin} =
        CMS.DocTree.create_pin(community, %{
          title: "GitHub",
          slug: "github",
          href: "https://github.com/groupher/groupher",
          base_revision: first_group.revision
        })

      {:ok, second_group} =
        CMS.DocTree.create_group(community, %{
          title: "API",
          slug: "api",
          base_revision: pin.revision
        })

      {:ok, _moved} =
        CMS.DocTree.move_node(community, second_group.node.id, %{
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
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            group_id: group_payload.node.id,
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
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            group_id: group_payload.node.id,
            title: "Install",
            slug: "install",
            base_revision: group_payload.revision
          },
          user
        )

      {:ok, draft} =
        CMS.DocTree.update_draft(
          community,
          page_payload.node.doc_id,
          %{
            title: "Updated Install",
            slug: "updated-install",
            body_bag: mock_body_bag(@plate_body)
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
      assert page_node.slug == "install"

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
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, _page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            group_id: group_payload.node.id,
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
          group_id: group.id,
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

  defp empty_docs_community(user) do
    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

    with {:ok, community} <- CMS.Communities.create(community_attrs, user),
         {:ok, _} <- CMS.DocTree.delete_demo_template(community) do
      {:ok, community}
    end
  end

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

  defp groups(%{tabs: [tab | _]}), do: tab.groups
  defp pins(%{tabs: [tab | _]}), do: tab.pins
end
