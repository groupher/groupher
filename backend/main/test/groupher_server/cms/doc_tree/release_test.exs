defmodule GroupherServer.Test.CMS.DocTree.Release do
  @moduledoc false

  use GroupherServer.TestMate

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

    test "builds one publish plan from doc drafts and tree events",
         ~m(community page_payload)a do
      plan = CMS.DocTree.publish_plan(community)

      assert plan.total_count == 2
      assert [%{id: "doc:" <> _, title: "Install", action: "created"}] = plan.doc_changes
      assert [%{id: "tree:" <> _, action: "created"}] = plan.tree_changes

      [doc_change] = plan.doc_changes
      assert doc_change.workspace_id == page_payload.node.workspace_id
      assert doc_change.selected_by_default
      assert doc_change.selectable
    end

    test "hides doc-bound page create tree events and archives them with doc publish",
         ~m(user community group_payload page_payload)a do
      {:ok, legacy_event} =
        CMS.DocTree.Events.record_staged(
          community,
          "node.create",
          %{
            "node" => %{
              "id" => page_payload.node.id,
              "type" => "page",
              "title" => page_payload.node.title,
              "slug" => page_payload.node.slug,
              "groupId" => group_payload.node.id,
              "workspaceId" => page_payload.node.workspace_id,
              "index" => page_payload.node.index
            }
          },
          %{"nodeId" => page_payload.node.id},
          user.id
        )

      plan = CMS.DocTree.publish_plan(community)

      assert plan.total_count == 2
      assert [%{title: "Install", action: "created"}] = plan.doc_changes
      refute Enum.any?(plan.tree_changes, &(&1.title == "Added Install"))

      assert {:ok, %{done: true, plan: next_plan}} =
               CMS.DocTree.publish_changes(community, %{}, user)

      assert next_plan.total_count == 0

      {:ok, legacy_event} = ORM.find(CMS.Model.DocTreeEvent, legacy_event.id)
      assert legacy_event.status == :published
    end

    test "publishes selected changes as one release",
         ~m(user community)a do
      assert {:ok, %{done: true, release: release, plan: next_plan}} =
               CMS.DocTree.publish_changes(community, %{}, user)

      assert release.release_number == 1
      assert next_plan.total_count == 0

      {:ok, state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)
      assert state.published_version == state.site_draft_version
      assert state.last_published_by_id == user.id

      {:ok, release} = ORM.find(CMS.Model.PublishRelease, release.id)
      release = Repo.preload(release, [:articles, :tree_events, :tree_snapshot])

      assert release.tree_snapshot.tree_json["version"] == 1

      assert [%CMS.Model.PublishReleaseArticle{actions: ["created"], title: "Install"}] =
               release.articles

      assert [
               %CMS.Model.PublishReleaseTreeEvent{
                 event_type: "node.create",
                 label: "Added Guides"
               }
             ] = release.tree_events

      assert CMS.DocTree.publish_plan(community).total_count == 0
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

      plan = CMS.DocTree.publish_plan(community)
      tree_change_count = length(plan.tree_changes)
      assert tree_change_count >= 2

      [first_tree_change | _] = plan.tree_changes

      assert {:ok, %{done: true}} =
               CMS.DocTree.publish_changes(
                 community,
                 %{doc_change_ids: [], tree_change_ids: [first_tree_change.id]},
                 user
               )

      next_plan = CMS.DocTree.publish_plan(community)

      assert length(next_plan.tree_changes) == tree_change_count - 1
      assert hd(next_plan.tree_changes).id != first_tree_change.id
      assert move_payload.tree_state.revision

      {:ok, state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)
      assert state.published_version != state.site_draft_version
      assert state.last_published_by_id == user.id
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
        CMS.DocTree.update_draft(community, page_payload.node.workspace_id, %{
          subtitle: "Edited subtitle"
        })

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

      assert page.publish_state.status == :public

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

    test "publishes rebuilt group with same slug after deleting published group",
         ~m(user community group_payload)a do
      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)
      {:ok, tree} = CMS.DocTree.read(community)

      {:ok, delete_payload} =
        CMS.DocTree.delete_node(community, group_payload.node.id, %{
          base_revision: tree.revision
        })

      {:ok, rebuilt_group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: delete_payload.revision
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

      assert {:ok, %{done: true, plan: next_plan}} =
               CMS.DocTree.publish_changes(community, %{}, user)

      assert next_plan.total_count == 0

      {:ok, published_group} =
        ORM.find_by(CMS.Model.DocTreeNode,
          community_id: community.id,
          stage: :public,
          node_id: rebuilt_group_payload.node.id
        )

      {:ok, published_page} =
        ORM.find_by(CMS.Model.DocTreeNode,
          community_id: community.id,
          stage: :public,
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
end
