defmodule GroupherServer.Test.CMS.DocTree.Publish.Release do
  @moduledoc false

  use GroupherServer.TestMate
  require CMS.Const

  @draft_body Jason.encode!([
                %{"type" => "h1", "children" => [%{"text" => "Restored Draft"}]},
                %{"type" => "p", "children" => [%{"text" => "draft body before delete"}]}
              ])

  describe "[doc publish release]" do
    setup do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, tree_state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: tree_state.tree_lock_version
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

      {:ok, ~m(user community group_payload page_payload)a}
    end

    test "builds one publish checklist from doc drafts and tree events",
         ~m(community page_payload)a do
      plan = CMS.DocTree.publish_checklist(community)

      assert plan.total_count == 1
      assert [%{id: "doc:" <> _, title: "Install", action: "created"}] = plan.doc_changes
      assert [] = plan.tree_changes

      [doc_change] = plan.doc_changes
      assert doc_change.doc_id == page_payload.node.doc_id
      assert doc_change.selected_by_default
      assert doc_change.selectable
    end

    test "hides doc-bound page create tree events and archives them with doc publish",
         ~m(user community group_payload page_payload)a do
      {:ok, legacy_event} =
        CMS.DocTree.Events.record_staged(
          community,
          CMS.Const.tree_event(:node_create),
          %{
            CMS.Const.doc_tree_json_key(:node) => %{
              CMS.Const.doc_tree_json_key(:id) => page_payload.node.id,
              CMS.Const.doc_tree_json_key(:type) => to_string(CMS.Const.tree_node_type(:page)),
              "title" => page_payload.node.title,
              "slug" => page_payload.node.slug,
              "groupId" => group_payload.node.id,
              CMS.Const.doc_tree_json_key(:doc_id) => page_payload.node.doc_id,
              "index" => page_payload.node.index
            }
          },
          %{"nodeId" => page_payload.node.id},
          user.id
        )

      plan = CMS.DocTree.publish_checklist(community)

      assert plan.total_count == 1
      assert [%{title: "Install", action: "created"}] = plan.doc_changes
      refute Enum.any?(plan.tree_changes, &(&1.title == "Added Install"))

      assert {:ok, %{done: true, checklist: next_checklist}} =
               CMS.DocTree.publish_changes(community, %{}, user)

      assert next_checklist.total_count == 0

      {:ok, legacy_event} = ORM.find(CMS.Model.DocTreeEvent, legacy_event.id)
      assert legacy_event.status == CMS.Const.tree_event_status(:published)
    end

    test "tree-only publish does not auto-publish doc-bound page creates",
         ~m(user community group_payload page_payload)a do
      {:ok, legacy_event} =
        CMS.DocTree.Events.record_staged(
          community,
          CMS.Const.tree_event(:node_create),
          %{
            CMS.Const.doc_tree_json_key(:node) => %{
              CMS.Const.doc_tree_json_key(:id) => page_payload.node.id,
              CMS.Const.doc_tree_json_key(:type) => to_string(CMS.Const.tree_node_type(:page)),
              "title" => page_payload.node.title,
              "slug" => page_payload.node.slug,
              "groupId" => group_payload.node.id,
              CMS.Const.doc_tree_json_key(:doc_id) => page_payload.node.doc_id,
              "index" => page_payload.node.index
            }
          },
          %{"nodeId" => page_payload.node.id},
          user.id
        )

      assert {:ok, %{done: true, checklist: next_checklist}} =
               CMS.DocTree.publish_changes(community, %{doc_change_ids: []}, user)

      assert Enum.any?(next_checklist.doc_changes, &(&1.doc_id == page_payload.node.doc_id))

      assert {:error, _} =
               ORM.find_by(CMS.Model.DocTreeNode,
                 community_id: community.id,
                 stage: CMS.Const.stage(:public),
                 node_id: page_payload.node.id
               )

      {:ok, legacy_event} = ORM.find(CMS.Model.DocTreeEvent, legacy_event.id)
      assert legacy_event.status == CMS.Const.tree_event_status(:staged)
    end

    test "explicit doc publish also clears its parent group shell event",
         ~m(user community group_payload)a do
      [doc_change] = CMS.DocTree.publish_checklist(community).doc_changes

      assert {:ok, %{done: true, checklist: next_checklist}} =
               CMS.DocTree.publish_changes(community, %{doc_change_ids: [doc_change.id]}, user)

      assert next_checklist.total_count == 0

      {:ok, group_event} = tree_create_event(community, group_payload.node.id)
      assert group_event.status == CMS.Const.tree_event_status(:published)
    end

    test "publishes selected changes as one release",
         ~m(user community)a do
      assert {:ok, %{done: true, release: release, checklist: next_checklist}} =
               CMS.DocTree.publish_changes(community, %{}, user)

      assert release.release_number == 1
      assert next_checklist.total_count == 0

      {:ok, state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)
      assert state.published_version == state.site_draft_version
      assert state.last_published_by_id == user.id

      {:ok, release} = ORM.find(CMS.Model.PublishRelease, release.id)
      release = Repo.preload(release, [:articles, :tree_events, :tree_snapshot])

      assert release.tree_snapshot.tree_json["version"] == 1

      assert [%CMS.Model.PublishReleaseArticle{actions: ["created"], title: "Install"}] =
               release.articles

      assert [] = release.tree_events

      assert CMS.DocTree.publish_checklist(community).total_count == 0
    end

    test "does not create a release when publish checklist is empty", ~m(user community)a do
      assert {:ok, %{done: true}} = CMS.DocTree.publish_changes(community, %{}, user)

      release_count_before = release_count(community)

      assert {:ok, %{done: true, release: nil, checklist: %{total_count: 0}}} =
               CMS.DocTree.publish_changes(community, %{}, user)

      assert release_count(community) == release_count_before
    end

    test "rejects explicit empty publish selection while changes exist", ~m(user community)a do
      release_count_before = release_count(community)

      assert {:error, {:custom, "No publish changes selected."}} =
               CMS.DocTree.publish_changes(
                 community,
                 %{doc_change_ids: [], tree_change_ids: []},
                 user
               )

      assert release_count(community) == release_count_before
      assert CMS.DocTree.publish_checklist(community).total_count == 1
    end

    test "publishes multiple newly created pages from one checklist",
         ~m(user community group_payload page_payload)a do
      {:ok, second_page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            group_id: group_payload.node.id,
            title: "Usage",
            slug: "usage",
            base_revision: page_payload.revision
          },
          user
        )

      checklist = CMS.DocTree.publish_checklist(community)

      assert length(checklist.doc_changes) == 2
      assert Enum.all?(checklist.doc_changes, & &1.selectable)

      assert Enum.sort(Enum.map(checklist.doc_changes, & &1.page_node_id)) ==
               Enum.sort([page_payload.node.id, second_page_payload.node.id])

      assert {:ok, %{done: true, checklist: next_checklist}} =
               CMS.DocTree.publish_changes(community, %{}, user)

      assert next_checklist.total_count == 0

      for page_payload <- [page_payload, second_page_payload] do
        {:ok, public_page} =
          ORM.find_by(CMS.Model.DocTreeNode,
            community_id: community.id,
            stage: CMS.Const.stage(:public),
            node_id: page_payload.node.id
          )

        assert public_page.doc_id == page_payload.node.doc_id
      end
    end

    test "publishes pages with the same slug in different groups",
         ~m(user community page_payload)a do
      {:ok, second_group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "API",
          slug: "api",
          base_revision: page_payload.revision
        })

      {:ok, second_page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            group_id: second_group_payload.node.id,
            title: "Install",
            slug: "install",
            base_revision: second_group_payload.revision
          },
          user
        )

      assert page_payload.node.slug == second_page_payload.node.slug
      refute page_payload.node.doc_id == second_page_payload.node.doc_id

      assert {:ok, %{done: true, checklist: next_checklist}} =
               CMS.DocTree.publish_changes(community, %{}, user)

      assert next_checklist.total_count == 0
    end

    test "publishes only selected tree events and leaves unchecked events staged",
         ~m(user community page_payload)a do
      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)

      {:ok, rename_payload} =
        CMS.DocTree.update_node(community, page_payload.node.id, %{
          title: "Install v2",
          slug: "install-v2",
          base_revision: page_payload.revision
        })

      {:ok, move_payload} =
        CMS.DocTree.move_node(community, page_payload.node.id, %{
          target_group_id: page_payload.node.group_id,
          target_index: 0,
          base_revision: rename_payload.revision
        })

      plan = CMS.DocTree.publish_checklist(community)
      tree_change_count = length(plan.tree_changes)
      assert tree_change_count >= 2

      [first_tree_change | _] = plan.tree_changes

      assert {:ok, %{done: true}} =
               CMS.DocTree.publish_changes(
                 community,
                 %{doc_change_ids: [], tree_change_ids: [first_tree_change.id]},
                 user
               )

      next_checklist = CMS.DocTree.publish_checklist(community)

      assert length(next_checklist.tree_changes) == tree_change_count - 1
      assert hd(next_checklist.tree_changes).id != first_tree_change.id
      assert move_payload.tree_state.revision

      {:ok, state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)
      assert state.published_version != state.site_draft_version
      assert state.last_published_by_id == user.id
    end

    test "restores unchecked deleted group with audit and without creating a release",
         ~m(user community group_payload page_payload)a do
      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)
      release_count_before = release_count(community)
      {:ok, tree} = CMS.DocTree.read(community)
      [group] = tree.groups

      {:ok, _delete_payload} =
        CMS.DocTree.delete_node(community, group.id, %{
          base_revision: tree.revision,
          actor_id: user.id
        })

      [delete_change] = CMS.DocTree.publish_checklist(community).tree_changes
      assert delete_change.action == "deleted"

      {:ok, state_before_restore} =
        ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)

      assert {:ok, %{release: nil, checklist: next_checklist}} =
               CMS.DocTree.publish_changes(
                 community,
                 %{
                   doc_change_ids: [],
                   tree_change_ids: [],
                   restore_tree_change_ids: [delete_change.id]
                 },
                 user
               )

      assert next_checklist.total_count == 0
      assert release_count(community) == release_count_before

      {:ok, tree} = CMS.DocTree.read(community)
      assert [%{id: group_id, children: [%{id: page_id}]}] = tree.groups
      assert group_id == group_payload.node.id
      assert page_id == page_payload.node.id

      {:ok, event} = ORM.find(CMS.Model.DocTreeEvent, delete_change.event_id)
      assert event.status == CMS.Const.tree_event_status(:discarded)

      restored_count =
        CMS.Model.DocTreeTrashItem
        |> where([item], item.community_id == ^community.id)
        |> where([item], item.node_id in ^[group_payload.node.id, page_payload.node.id])
        |> where([item], not is_nil(item.restored_at))
        |> Repo.aggregate(:count, :id)

      assert restored_count == 2

      {:ok, state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)
      assert state.tree_lock_version == state_before_restore.tree_lock_version
      assert state.site_draft_version == state_before_restore.site_draft_version + 1
      assert state.staged_event_count == max(state_before_restore.staged_event_count - 1, 0)
      assert state.published_version == state.site_draft_version

      [audit] =
        CMS.Model.DocTreeRestoreAudit
        |> where([audit], audit.community_id == ^community.id)
        |> Repo.all()

      assert audit.actor_id == user.id
      assert audit.restored_event_ids == [delete_change.event_id]

      assert Enum.sort(audit.restored_node_ids) ==
               Enum.sort([group_payload.node.id, page_payload.node.id])

      assert %{"items" => items} = audit.payload
      assert Enum.count(items) == 2
      assert Enum.any?(items, &(&1["nodeId"] == group_payload.node.id))
      assert Enum.any?(items, &(&1["nodeId"] == page_payload.node.id))
    end

    test "restoring deleted group also restores child page draft content",
         ~m(user community page_payload)a do
      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)

      {:ok, _draft} =
        CMS.DocTree.update_draft(
          community,
          page_payload.node.doc_id,
          %{
            title: "Install Draft",
            slug: "install-draft",
            subtitle: "Draft before delete",
            body: @draft_body
          },
          user
        )

      {:ok, tree} = CMS.DocTree.read(community)
      [group] = tree.groups

      {:ok, _delete_payload} =
        CMS.DocTree.delete_node(community, group.id, %{
          base_revision: tree.revision,
          actor_id: user.id
        })

      assert {:error, _} =
               ORM.find_by(CMS.Model.Doc,
                 community_id: community.id,
                 stage: CMS.Const.stage(:draft),
                 doc_id: page_payload.node.doc_id
               )

      [delete_change] = CMS.DocTree.publish_checklist(community).tree_changes

      assert {:ok, %{release: nil, checklist: next_checklist}} =
               CMS.DocTree.publish_changes(
                 community,
                 %{
                   doc_change_ids: [],
                   tree_change_ids: [],
                   restore_tree_change_ids: [delete_change.id]
                 },
                 user
               )

      assert next_checklist.total_count == 1
      assert [%{title: "Install Draft", action: "modified"}] = next_checklist.doc_changes

      {:ok, draft} =
        ORM.find_by(CMS.Model.Doc,
          community_id: community.id,
          stage: CMS.Const.stage(:draft),
          doc_id: page_payload.node.doc_id
        )

      assert draft.title == "Install Draft"
      assert draft.subtitle == "Draft before delete"
      assert draft.slug == "install-draft"
      assert draft.json == @draft_body

      {:ok, state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)
      assert state.published_version != state.site_draft_version
    end

    test "can publish one deleted item while restoring another",
         ~m(user community group_payload page_payload)a do
      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)
      {:ok, tree} = CMS.DocTree.read(community)

      {:ok, link_payload} =
        CMS.DocTree.create_link(community, %{
          group_id: group_payload.node.id,
          title: "Reference",
          slug: "reference",
          href: "https://example.com",
          base_revision: tree.revision
        })

      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)
      {:ok, tree} = CMS.DocTree.read(community)

      {:ok, page_delete_payload} =
        CMS.DocTree.delete_node(community, page_payload.node.id, %{
          base_revision: tree.revision,
          actor_id: user.id
        })

      {:ok, _link_delete_payload} =
        CMS.DocTree.delete_node(community, link_payload.node.id, %{
          base_revision: page_delete_payload.revision,
          actor_id: user.id
        })

      changes = CMS.DocTree.publish_checklist(community).tree_changes
      page_delete = Enum.find(changes, &(&1.title == "Deleted Install"))
      link_delete = Enum.find(changes, &(&1.title == "Deleted Reference"))

      assert page_delete
      assert link_delete

      assert {:ok, %{release: release, checklist: next_checklist}} =
               CMS.DocTree.publish_changes(
                 community,
                 %{
                   doc_change_ids: [],
                   tree_change_ids: [link_delete.id],
                   restore_tree_change_ids: [page_delete.id]
                 },
                 user
               )

      assert release
      assert next_checklist.total_count == 0

      {:ok, _restored_page} =
        ORM.find_by(CMS.Model.DocTreeNode,
          community_id: community.id,
          stage: CMS.Const.stage(:draft),
          node_id: page_payload.node.id
        )

      assert {:error, _} =
               ORM.find_by(CMS.Model.DocTreeNode,
                 community_id: community.id,
                 stage: CMS.Const.stage(:draft),
                 node_id: link_payload.node.id
               )

      assert {:error, _} =
               ORM.find_by(CMS.Model.DocTreeNode,
                 community_id: community.id,
                 stage: CMS.Const.stage(:public),
                 node_id: link_payload.node.id
               )
    end

    test "rejects restoring non-delete tree changes", ~m(user community page_payload)a do
      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)

      {:ok, _rename_payload} =
        CMS.DocTree.update_node(community, page_payload.node.id, %{
          title: "Install v2",
          slug: "install-v2",
          base_revision: page_payload.revision
        })

      rename_change =
        community
        |> CMS.DocTree.publish_checklist()
        |> Map.get(:tree_changes)
        |> Enum.find(&(&1.action == "renamed"))

      assert rename_change

      assert {:error, {:custom, "Only deleted tree publish items can be restored."}} =
               CMS.DocTree.publish_changes(
                 community,
                 %{
                   doc_change_ids: [],
                   tree_change_ids: [],
                   restore_tree_change_ids: [rename_change.id]
                 },
                 user
               )
    end

    test "rejects publishing and restoring the same tree item",
         ~m(user community page_payload)a do
      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)
      {:ok, tree} = CMS.DocTree.read(community)

      {:ok, _delete_payload} =
        CMS.DocTree.delete_node(community, page_payload.node.id, %{
          base_revision: tree.revision,
          actor_id: user.id
        })

      [delete_change] = CMS.DocTree.publish_checklist(community).tree_changes

      assert {:error, {:custom, "Tree publish items can not be both published and restored."}} =
               CMS.DocTree.publish_changes(
                 community,
                 %{
                   doc_change_ids: [],
                   tree_change_ids: [delete_change.id],
                   restore_tree_change_ids: [delete_change.id]
                 },
                 user
               )
    end

    test "merges doc and tree actions for the same article in one release",
         ~m(user community page_payload)a do
      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)
      {:ok, tree} = CMS.DocTree.read(community)

      {:ok, group_payload_2} =
        CMS.DocTree.create_group(community, %{
          title: "API",
          slug: "api",
          base_revision: tree.revision
        })

      {:ok, _draft} =
        CMS.DocTree.update_draft(
          community,
          page_payload.node.doc_id,
          %{
            subtitle: "Edited subtitle"
          },
          user
        )

      {:ok, _move_payload} =
        CMS.DocTree.move_node(community, page_payload.node.id, %{
          target_group_id: group_payload_2.node.id,
          target_index: 0,
          base_revision: group_payload_2.revision
        })

      assert {:ok, %{release: release}} = CMS.DocTree.publish_changes(community, %{}, user)

      {:ok, release} = ORM.find(CMS.Model.PublishRelease, release.id)
      release = Repo.preload(release, :articles)

      assert [
               %CMS.Model.PublishReleaseArticle{
                 actions: actions,
                 group_node_id: group_node_id,
                 node_id: node_id
               }
             ] = release.articles

      assert Enum.sort(actions) == ["modified", "moved"]
      assert group_node_id == group_payload_2.node.id
      assert node_id == page_payload.node.id
    end

    test "records deleted published pages from their pre-delete public snapshot",
         ~m(user community page_payload)a do
      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)
      {:ok, tree} = CMS.DocTree.read(community)
      [group] = tree.groups
      [page] = group.children

      assert page.publish_state.status == CMS.Const.stage(:public)

      {:ok, _delete_payload} =
        CMS.DocTree.delete_node(community, page_payload.node.id, %{
          base_revision: tree.revision
        })

      assert {:ok, %{release: release}} =
               CMS.DocTree.publish_changes(community, %{doc_change_ids: []}, user)

      {:ok, release} = ORM.find(CMS.Model.PublishRelease, release.id)
      release = Repo.preload(release, :articles)

      assert [
               %CMS.Model.PublishReleaseArticle{
                 actions: ["deleted"],
                 node_id: node_id,
                 group_node_id: group_node_id,
                 index: 0,
                 snapshot_id: snapshot_id
               }
             ] = release.articles

      assert node_id == page_payload.node.id
      assert group_node_id == group.id
      assert snapshot_id
    end

    test "rejects publishing a doc whose page is selected for tree deletion",
         ~m(user community page_payload)a do
      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)
      {:ok, tree} = CMS.DocTree.read(community)

      {:ok, _delete_payload} =
        CMS.DocTree.delete_node(community, page_payload.node.id, %{
          base_revision: tree.revision
        })

      {:ok, _draft} =
        CMS.DocTree.update_draft(
          community,
          page_payload.node.doc_id,
          %{subtitle: "Draft after delete"},
          user
        )

      checklist = CMS.DocTree.publish_checklist(community)
      doc_change = Enum.find(checklist.doc_changes, &(&1.doc_id == page_payload.node.doc_id))
      delete_change = Enum.find(checklist.tree_changes, &(&1.action == "deleted"))

      assert doc_change.selectable
      assert delete_change

      assert {:error, {:custom, "Selected docs publish item is also selected for tree deletion."}} =
               CMS.DocTree.publish_changes(
                 community,
                 %{
                   doc_change_ids: [doc_change.id],
                   tree_change_ids: [delete_change.id]
                 },
                 user
               )

      {:ok, public_page} =
        ORM.find_by(CMS.Model.DocTreeNode,
          community_id: community.id,
          stage: CMS.Const.stage(:public),
          node_id: page_payload.node.id
        )

      assert public_page.doc_id == page_payload.node.doc_id
    end

    test "deleting a group removes child page draft docs from publish checklist",
         ~m(user community page_payload)a do
      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)

      {:ok, _draft} =
        CMS.DocTree.update_draft(
          community,
          page_payload.node.doc_id,
          %{subtitle: "Draft before delete"},
          user
        )

      assert Enum.any?(
               CMS.DocTree.publish_checklist(community).doc_changes,
               &(&1.doc_id == page_payload.node.doc_id)
             )

      {:ok, tree} = CMS.DocTree.read(community)
      [group] = tree.groups

      assert {:ok, _delete_payload} =
               CMS.DocTree.delete_node(community, group.id, %{
                 base_revision: tree.revision
               })

      assert {:error, _} =
               ORM.find_by(CMS.Model.Doc,
                 community_id: community.id,
                 stage: CMS.Const.stage(:draft),
                 doc_id: page_payload.node.doc_id
               )

      refute Enum.any?(
               CMS.DocTree.publish_checklist(community).doc_changes,
               &(&1.doc_id == page_payload.node.doc_id)
             )

      assert {:ok, %{done: true, checklist: next_checklist}} =
               CMS.DocTree.publish_changes(community, %{doc_change_ids: []}, user)

      assert next_checklist.total_count == 0
    end

    test "allows same group slug after published deletion",
         ~m(user community group_payload)a do
      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)
      {:ok, tree} = CMS.DocTree.read(community)

      {:ok, _delete_payload} =
        CMS.DocTree.delete_node(community, group_payload.node.id, %{
          base_revision: tree.revision
        })

      assert {:ok, %{checklist: %{total_count: 0}}} =
               CMS.DocTree.publish_changes(community, %{doc_change_ids: []}, user)

      {:ok, tree} = CMS.DocTree.read(community)

      {:ok, rebuilt_group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: tree.revision
        })

      {:ok, rebuilt_page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            group_id: rebuilt_group_payload.node.id,
            title: "Install Again",
            slug: "install",
            base_revision: rebuilt_group_payload.revision
          },
          user
        )

      assert {:ok, %{done: true, checklist: next_checklist}} =
               CMS.DocTree.publish_changes(community, %{}, user)

      assert next_checklist.total_count == 0

      {:ok, published_group} =
        ORM.find_by(CMS.Model.DocTreeNode,
          community_id: community.id,
          stage: CMS.Const.stage(:public),
          node_id: rebuilt_group_payload.node.id
        )

      {:ok, published_page} =
        ORM.find_by(CMS.Model.DocTreeNode,
          community_id: community.id,
          stage: CMS.Const.stage(:public),
          node_id: rebuilt_page_payload.node.id
        )

      assert published_group.slug == "guides"
      assert published_page.group_id == rebuilt_group_payload.node.id
    end
  end

  defp empty_docs_community(user) do
    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

    with {:ok, community} <- CMS.Communities.create(community_attrs, user),
         {:ok, _} <- CMS.DocTree.delete_demo_template(community) do
      {:ok, community}
    end
  end

  defp release_count(community) do
    CMS.Model.PublishRelease
    |> where([r], r.community_id == ^community.id)
    |> Repo.aggregate(:count, :id)
  end

  defp tree_create_event(community, node_id) do
    CMS.Model.DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.owner == ^CMS.Const.tree_event_owner(:tree))
    |> where([e], e.event_type == ^CMS.Const.tree_event(:node_create))
    |> where([e], e.node_id == ^node_id)
    |> Repo.one()
    |> case do
      %CMS.Model.DocTreeEvent{} = event -> {:ok, event}
      nil -> {:error, {:custom, "Tree create event not found."}}
    end
  end
end
