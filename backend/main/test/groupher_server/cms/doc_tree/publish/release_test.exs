defmodule GroupherServer.Test.CMS.DocTree.Publish.Release do
  @moduledoc false

  use GroupherServer.TestMate
  require CMS.Const

  alias CMS.Gate.Context.Scope.Doc, as: DocScope

  describe "[doc publish release]" do
    setup do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, tree_state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "Guides",
          slug: "guides",
          base_revision: tree_state.tree_lock_version
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

    test "rejects moving a public Doc back to draft when the Community is not writable",
         ~m(user community page_payload)a do
      assert {:ok, %{done: true}} = CMS.DocTree.publish_changes(community, %{}, user)

      {:ok, _blocker} =
        CMS.Communities.Lifecycle.apply_blocker(
          community.slug,
          %{blocker_type: :moderation_suspend, cause_code: "review_pending"},
          operation_ref: Ecto.UUID.generate()
        )

      assert {:error, %GroupherServer.ErrorCat.Error{reason: :ancestor_community_not_writable}} =
               CMS.DocTree.move_doc_to_draft(community, page_payload.node.id, user)
    end

    test "returns a domain error for an unknown branch", ~m(community)a do
      assert {:error, _reason} = CMS.DocTree.publish_checklist(community, branch_id: -1)
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
              "parentNodeId" => group_payload.node.id,
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
              "parentNodeId" => group_payload.node.id,
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

      {:ok, release} = ORM.find(CMS.Model.DocPublishRelease, release.id)
      release = Repo.preload(release, [:articles, :tree_events, :tree_snapshot])
      assert release.branch_id == state.branch_id

      assert release.tree_snapshot.tree_json["version"] == 3

      assert [%CMS.Model.DocPublishReleaseArticle{actions: ["created"], title: "Install"}] =
               release.articles

      assert [] = release.tree_events

      assert CMS.DocTree.publish_checklist(community).total_count == 0
    end

    test "publishes a non-main branch into its own release and site cursor",
         ~m(user community)a do
      {:ok, branch} =
        CMS.Docs.Branch.create_preview(
          community,
          %{slug: "preview-release"},
          user
        )

      {:ok, state} = CMS.DocTree.initialize(community, branch_id: branch.id)

      {:ok, tab} =
        ORM.create(CMS.Model.DocTreeNode, %{
          community_id: community.id,
          branch_id: branch.id,
          stage: :draft,
          node_id: Ecto.UUID.generate(),
          type: :tab,
          title: "Preview",
          index: 0
        })

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          branch_id: branch.id,
          parent_node_id: tab.node_id,
          title: "Preview Guides",
          slug: "preview-guides",
          base_revision: state.tree_lock_version
        })

      {:ok, _page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            branch_id: branch.id,
            parent_node_id: group_payload.node.id,
            title: "Preview Install",
            slug: "preview-install",
            base_revision: group_payload.revision
          },
          user
        )

      assert {:ok, %{done: true, release: release, checklist: %{total_count: 0}}} =
               CMS.DocTree.publish_changes(community, %{branch_id: branch.id}, user)

      assert release.branch_id == branch.id

      {:ok, published_state} =
        ORM.find_by(CMS.Model.DocsSiteState,
          community_id: community.id,
          branch_id: branch.id
        )

      assert published_state.published_version == published_state.site_draft_version
      assert published_state.branch_id == branch.id

      assert {:ok, ^release} = ORM.find(CMS.Model.DocPublishRelease, release.id)

      public_scope =
        CMS.Gate.scope(CMS.Model.Doc, nil, :read, DocScope.public_branch(branch.id))
        |> where([doc], doc.community_id == ^community.id and doc.branch_id == ^branch.id)

      refute Repo.exists?(public_scope)

      dashboard_scope =
        CMS.Gate.scope(
          CMS.Model.Doc,
          :operations,
          :read,
          DocScope.public_branch(branch.id, policy_mode: :operations)
        )
        |> where([doc], doc.community_id == ^community.id and doc.branch_id == ^branch.id)

      assert Repo.exists?(dashboard_scope)
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

      assert {:error,
              %GroupherServer.ErrorCat.Error{
                reason: :custom,
                details: "No publish changes selected."
              }} =
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
            parent_node_id: group_payload.node.id,
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

    test "keeps canonical Doc slugs unique across navigation groups",
         ~m(user community page_payload)a do
      {:ok, second_group_payload} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "API",
          slug: "api",
          base_revision: page_payload.revision
        })

      {:ok, second_page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_node_id: second_group_payload.node.id,
            title: "Install",
            slug: "install",
            base_revision: second_group_payload.revision
          },
          user
        )

      {:ok, first_doc} =
        ORM.find_by(CMS.Model.Doc,
          community_id: community.id,
          stage: :draft,
          article_hash_id: page_payload.node.doc_id
        )

      {:ok, second_doc} =
        ORM.find_by(CMS.Model.Doc,
          community_id: community.id,
          stage: :draft,
          article_hash_id: second_page_payload.node.doc_id
        )

      assert first_doc.slug == "install"
      assert second_doc.slug == "install-copy"
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
          target_parent_node_id: page_payload.node.parent_node_id,
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

      assert {:error,
              %GroupherServer.ErrorCat.Error{
                reason: :custom,
                details: "Only deleted tree publish items can be restored."
              }} =
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

    test "merges doc and tree actions for the same article in one release",
         ~m(user community page_payload)a do
      {:ok, _release} = CMS.DocTree.publish_changes(community, %{}, user)
      {:ok, tree} = CMS.DocTree.read(community)

      {:ok, group_payload_2} =
        CMS.DocTree.create_group(community, %{
          parent_node_id: root_doc_tab_node_id(community),
          title: "API",
          slug: "api",
          base_revision: tree.revision
        })

      {:ok, current} =
        CMS.Articles.read_editor(community, :doc, page_payload.node.doc_id)

      {:ok, _draft} =
        CMS.DocTree.update_draft(
          community,
          page_payload.node.doc_id,
          %{
            subtitle: "Edited subtitle",
            expected_version: current.version
          },
          user
        )

      {:ok, _move_payload} =
        CMS.DocTree.move_node(community, page_payload.node.id, %{
          target_parent_node_id: group_payload_2.node.id,
          target_index: 0,
          base_revision: group_payload_2.revision
        })

      assert {:ok, %{release: release}} = CMS.DocTree.publish_changes(community, %{}, user)

      {:ok, release} = ORM.find(CMS.Model.DocPublishRelease, release.id)
      release = Repo.preload(release, :articles)

      assert [
               %CMS.Model.DocPublishReleaseArticle{
                 actions: actions,
                 group_node_id: group_node_id,
                 node_id: node_id
               }
             ] = release.articles

      assert Enum.sort(actions) == ["modified", "moved"]
      assert group_node_id == group_payload_2.node.id
      assert node_id == page_payload.node.id
    end
  end

  defp empty_docs_community(user), do: create_empty_docs_community(user)

  defp release_count(community) do
    CMS.Model.DocPublishRelease
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
      %CMS.Model.DocTreeEvent{} = event ->
        {:ok, event}

      nil ->
        {:error, GroupherServer.ErrorCat.custom("Tree create event not found.")}
    end
  end
end
