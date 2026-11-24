defmodule GroupherServer.Test.CMS.DocTree.WorkspaceRestoreTargetTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  @tree_snapshot_fields ~w(node_id type parent_node_id index title doc_id marker badge hidden)a
  @trash_node_snapshot_fields ~w(node_id type doc_id draft_snapshot queue_snapshot public_snapshot)a
  @trash_doc_snapshot_fields ~w(article_id restore_state)a

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.Commands.{CreateWorkspaceNode, DeleteWorkspaceNode, RestoreWorkspaceNode}
  alias CMS.DocTree.Publish.Queue

  alias CMS.Model.{
    CommunityAdmin,
    DocsPublishQueue,
    DocsQueueTreeChange,
    DocsTreeNode,
    DocsTrashedTreeNode,
    TrashAction
  }

  test "restore rejects pending ancestors and cycles after locking, preserving the Trash action" do
    Sandbox.unboxed_run(Repo, fn ->
      {:ok, actor} = db_insert(:user)
      {:ok, community} = mock_community(actor)
      admin = Repo.get_by!(CommunityAdmin, user_id: actor.id, community_id: community.id)

      Repo.update!(
        Ecto.Changeset.change(admin,
          permissions: Map.put(admin.permissions || %{}, "community.article.trash.read", true)
        )
      )

      tab = create_node(community, actor, %{type: :tab, title: "Docs"})

      parent =
        create_node(community, actor, %{
          type: :group,
          title: "Pending parent",
          parent_node_id: tab.node_id
        })

      alternate_parent =
        create_node(community, actor, %{
          type: :group,
          title: "Valid moved destination",
          parent_node_id: tab.node_id
        })

      page =
        create_node(community, actor, %{
          type: :page,
          title: "Restored page",
          parent_node_id: parent.node_id
        })

      {:ok, queue} = Queue.read(community)

      assert {:ok, deleted} =
               DeleteWorkspaceNode.execute(
                 community,
                 queue.tree_lock_version,
                 queue.queue_revision,
                 page.node_id,
                 nil,
                 actor,
                 Ecto.UUID.generate()
               )

      {:ok, queue} = Queue.read(community)

      publish_draft_node(community, tab.node_id)
      publish_draft_node(community, parent.node_id)

      Repo.insert!(
        DocsQueueTreeChange.changeset(%DocsQueueTreeChange{}, %{
          queue_id: queue.id,
          community_id: community.id,
          node_id: parent.node_id,
          change_type: :delete
        })
      )

      queue =
        queue
        |> Ecto.Changeset.change(queue_revision: queue.queue_revision + 1)
        |> Repo.update!()

      {:ok, item} =
        CMS.Articles.CommunityTrashQuery.get(
          community,
          actor,
          :doc,
          deleted.trash_action_id
        )

      action = Repo.get_by!(TrashAction, hash_id: deleted.trash_action_id)

      for target_parent <- [parent.node_id, page.node_id] do
        assert {:error, :invalid_restore_parent} =
                 RestoreWorkspaceNode.execute(
                   community,
                   queue.tree_lock_version,
                   queue.queue_revision,
                   deleted.trash_action_id,
                   item.record_revision,
                   target_parent,
                   nil,
                   actor,
                   Ecto.UUID.generate()
                 )

        assert Repo.exists?(
                 from(node in DocsTrashedTreeNode,
                   where: node.trash_action_id == ^action.id
                 )
               )

        refute Repo.get_by(DocsTreeNode,
                 community_id: community.id,
                 stage: :draft,
                 node_id: page.node_id
               )
      end

      assert Repo.get!(DocsPublishQueue, queue.id).queue_revision == queue.queue_revision

      trashed_page =
        Repo.get_by!(DocsTrashedTreeNode,
          trash_action_id: action.id,
          node_id: page.node_id
        )

      trashed_page
      |> DocsTrashedTreeNode.changeset(%{
        draft_snapshot: Map.put(trashed_page.draft_snapshot, "parent_node_id", "missing-parent")
      })
      |> Repo.update!()

      missing_parent_error = CMS.ErrorCat.docs_restore_parent_missing()

      assert {:error, ^missing_parent_error} =
               RestoreWorkspaceNode.execute(
                 community,
                 queue.tree_lock_version,
                 queue.queue_revision,
                 deleted.trash_action_id,
                 item.record_revision,
                 :restore_original,
                 nil,
                 actor,
                 Ecto.UUID.generate()
               )

      assert Repo.exists?(
               from(node in DocsTrashedTreeNode,
                 where: node.trash_action_id == ^action.id
               )
             )

      refute Repo.get_by(DocsTreeNode,
               community_id: community.id,
               stage: :draft,
               node_id: page.node_id
             )

      trashed_page = Repo.get!(DocsTrashedTreeNode, trashed_page.id)

      trashed_page
      |> DocsTrashedTreeNode.changeset(%{
        draft_snapshot: Map.put(trashed_page.draft_snapshot, "parent_node_id", parent.node_id)
      })
      |> Repo.update!()

      stale_tree_version = queue.tree_lock_version

      queue =
        queue
        |> Ecto.Changeset.change(tree_lock_version: queue.tree_lock_version + 1)
        |> Repo.update!()

      {:ok, fresh_item} =
        CMS.Articles.CommunityTrashQuery.get(
          community,
          actor,
          :doc,
          deleted.trash_action_id
        )

      assert {:error, _conflict} =
               RestoreWorkspaceNode.execute(
                 community,
                 stale_tree_version,
                 queue.queue_revision,
                 deleted.trash_action_id,
                 fresh_item.record_revision,
                 alternate_parent.node_id,
                 nil,
                 actor,
                 Ecto.UUID.generate()
               )

      assert Repo.exists?(
               from(node in DocsTrashedTreeNode,
                 where: node.trash_action_id == ^action.id
               )
             )

      refute Repo.get_by(DocsTreeNode,
               community_id: community.id,
               stage: :draft,
               node_id: page.node_id
             )

      assert {:ok, _restored} =
               RestoreWorkspaceNode.execute(
                 community,
                 queue.tree_lock_version,
                 queue.queue_revision,
                 deleted.trash_action_id,
                 fresh_item.record_revision,
                 alternate_parent.node_id,
                 nil,
                 actor,
                 Ecto.UUID.generate()
               )

      restored_page =
        Repo.get_by!(DocsTreeNode,
          community_id: community.id,
          stage: :draft,
          node_id: page.node_id
        )

      assert restored_page.parent_node_id == alternate_parent.node_id
      refute Repo.get_by(TrashAction, hash_id: deleted.trash_action_id)
    end)
  end

  test "restore reinstates the saved subtree order and leaves it intact on failure" do
    Sandbox.unboxed_run(Repo, fn ->
      {:ok, actor} = db_insert(:user)
      {:ok, community} = mock_community(actor)
      admin = Repo.get_by!(CommunityAdmin, user_id: actor.id, community_id: community.id)

      Repo.update!(
        Ecto.Changeset.change(admin,
          permissions: Map.put(admin.permissions || %{}, "community.article.trash.read", true)
        )
      )

      tab = create_node(community, actor, %{type: :tab, title: "Docs"})

      left =
        create_node(community, actor, %{type: :group, title: "Left", parent_node_id: tab.node_id})

      subtree =
        create_node(community, actor, %{
          type: :group,
          title: "Restored group",
          parent_node_id: tab.node_id
        })

      nested =
        create_node(community, actor, %{
          type: :group,
          title: "Nested group",
          parent_node_id: subtree.node_id
        })

      first_page =
        create_node(community, actor, %{
          type: :page,
          title: "First page",
          parent_node_id: nested.node_id
        })

      second_page =
        create_node(community, actor, %{
          type: :page,
          title: "Second page",
          parent_node_id: nested.node_id
        })

      right =
        create_node(community, actor, %{type: :group, title: "Right", parent_node_id: tab.node_id})

      saved_tree = draft_snapshot(community)

      assert Enum.sort(Enum.map(saved_tree, & &1.node_id)) ==
               Enum.sort([
                 tab.node_id,
                 left.node_id,
                 subtree.node_id,
                 nested.node_id,
                 first_page.node_id,
                 second_page.node_id,
                 right.node_id
               ])

      {:ok, queue} = Queue.read(community)

      assert {:ok, deleted} =
               DeleteWorkspaceNode.execute(
                 community,
                 queue.tree_lock_version,
                 queue.queue_revision,
                 subtree.node_id,
                 nil,
                 actor,
                 Ecto.UUID.generate()
               )

      action = Repo.get_by!(TrashAction, hash_id: deleted.trash_action_id)

      trashed_root =
        Repo.get_by!(DocsTrashedTreeNode, trash_action_id: action.id, node_id: subtree.node_id)

      saved_root_snapshot = trashed_root.draft_snapshot

      trashed_root
      |> DocsTrashedTreeNode.changeset(%{
        draft_snapshot: Map.put(trashed_root.draft_snapshot, "parent_node_id", "missing-parent")
      })
      |> Repo.update!()

      {:ok, item} =
        CMS.Articles.CommunityTrashQuery.get(
          community,
          actor,
          :doc,
          deleted.trash_action_id
        )

      draft_before_failure = draft_snapshot(community)
      queue_before_failure = queue_versions(community)
      trash_before_failure = trash_snapshot(community, deleted.trash_action_id)
      missing_parent_error = CMS.ErrorCat.docs_restore_parent_missing()

      assert {:error, ^missing_parent_error} =
               RestoreWorkspaceNode.execute(
                 community,
                 queue_before_failure.tree_lock_version,
                 queue_before_failure.queue_revision,
                 deleted.trash_action_id,
                 item.record_revision,
                 :restore_original,
                 nil,
                 actor,
                 Ecto.UUID.generate()
               )

      assert draft_snapshot(community) == draft_before_failure
      assert queue_versions(community) == queue_before_failure
      assert trash_snapshot(community, deleted.trash_action_id) == trash_before_failure

      trashed_root = Repo.get!(DocsTrashedTreeNode, trashed_root.id)

      trashed_root
      |> DocsTrashedTreeNode.changeset(%{draft_snapshot: saved_root_snapshot})
      |> Repo.update!()

      {:ok, item} =
        CMS.Articles.CommunityTrashQuery.get(
          community,
          actor,
          :doc,
          deleted.trash_action_id
        )

      {:ok, queue} = Queue.read(community)

      assert {:ok, restored} =
               RestoreWorkspaceNode.execute(
                 community,
                 queue.tree_lock_version,
                 queue.queue_revision,
                 deleted.trash_action_id,
                 item.record_revision,
                 :restore_original,
                 nil,
                 actor,
                 Ecto.UUID.generate()
               )

      assert draft_snapshot(community) == saved_tree
      assert restored.tree_revision == queue.tree_lock_version + 1
      assert restored.queue_revision == queue.queue_revision
      assert is_nil(trash_snapshot(community, deleted.trash_action_id))
    end)
  end

  @tag skip: System.get_env("TEST_REF_ISOLATED") != "1"
  @tag timeout: 60_000
  test "two editors restoring the same folder commit exactly one complete subtree" do
    Sandbox.unboxed_run(Repo, fn ->
      {:ok, owner} = db_insert(:user)
      {:ok, community} = mock_community(owner)
      {:ok, editor} = db_insert(:user)

      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          user_id: editor.id,
          community_id: community.id,
          permissions: %{
            "doc.queue.write" => true,
            "doc.queue.preview" => true,
            "community.article.trash.read" => true
          }
        })
      )

      assert {:ok, _} = CMS.Gate.access_check(editor, :manage_docs, community)

      tab = create_node(community, owner, %{type: :tab, title: "Docs"})

      folder =
        create_node(community, owner, %{
          type: :group,
          title: "Concurrent restore",
          parent_node_id: tab.node_id
        })

      create_node(community, owner, %{type: :page, title: "Child", parent_node_id: folder.node_id})

      expected = draft_snapshot(community)
      {:ok, before_delete} = Queue.read(community)

      assert {:ok, deleted} =
               DeleteWorkspaceNode.execute(
                 community,
                 before_delete.tree_lock_version,
                 before_delete.queue_revision,
                 folder.node_id,
                 nil,
                 owner,
                 Ecto.UUID.generate()
               )

      {:ok, item} =
        CMS.Articles.CommunityTrashQuery.get(community, owner, :doc, deleted.trash_action_id)

      {:ok, queue} = Queue.read(community)
      parent = self()

      workers =
        for actor <- [owner, editor] do
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, {:restore_ready, self()})

              receive do
                :restore ->
                  RestoreWorkspaceNode.execute(
                    community,
                    queue.tree_lock_version,
                    queue.queue_revision,
                    deleted.trash_action_id,
                    item.record_revision,
                    :restore_original,
                    nil,
                    actor,
                    Ecto.UUID.generate()
                  )
              after
                10_000 -> {:error, :restore_start_timeout}
              end
            end)
          end)
        end

      pids =
        for _ <- workers do
          assert_receive {:restore_ready, pid}, 10_000
          pid
        end

      Enum.each(pids, &send(&1, :restore))
      results = Enum.map(workers, &Task.await(&1, 20_000))
      assert Enum.count(results, &match?({:ok, _}, &1)) == 1
      assert Enum.count(results, &match?({:error, _}, &1)) == 1
      [{:error, conflict}] = Enum.filter(results, &match?({:error, _}, &1))
      assert conflict == CMS.ErrorCat.docs_state_conflict()
      refute Enum.any?(results, &(&1 == {:error, :restore_start_timeout}))
      assert draft_snapshot(community) == expected
      assert is_nil(trash_snapshot(community, deleted.trash_action_id))
      assert queue_versions(community).tree_lock_version == queue.tree_lock_version + 1
    end)
  end

  defp create_node(community, actor, attrs) do
    {:ok, queue} = Queue.read(community)

    assert {:ok, result} =
             CreateWorkspaceNode.execute(
               community,
               queue.tree_lock_version,
               attrs,
               actor,
               Ecto.UUID.generate()
             )

    result
  end

  defp publish_draft_node(community, node_id) do
    draft =
      Repo.get_by!(DocsTreeNode,
        community_id: community.id,
        stage: :draft,
        node_id: node_id
      )

    draft
    |> Map.take([
      :community_id,
      :node_id,
      :type,
      :parent_node_id,
      :doc_id,
      :title,
      :index,
      :href,
      :marker,
      :badge,
      :hidden
    ])
    |> Map.put(:stage, :public)
    |> then(&DocsTreeNode.changeset(%DocsTreeNode{}, &1))
    |> Repo.insert!()
  end

  defp draft_snapshot(community) do
    Repo.all(
      from(node in DocsTreeNode,
        where: node.community_id == ^community.id and node.stage == :draft,
        order_by: node.node_id
      )
    )
    |> Enum.map(&Map.take(&1, @tree_snapshot_fields))
  end

  defp queue_versions(community) do
    {:ok, queue} = Queue.read(community)

    Map.take(queue, [:tree_lock_version, :queue_revision])
  end

  defp trash_snapshot(community, action_hash_id) do
    case Repo.get_by(TrashAction, hash_id: action_hash_id, community_id: community.id) do
      nil ->
        nil

      action ->
        nodes =
          Repo.all(
            from(node in DocsTrashedTreeNode,
              where: node.trash_action_id == ^action.id,
              order_by: node.node_id
            )
          )
          |> Enum.map(&Map.take(&1, @trash_node_snapshot_fields))

        docs =
          Repo.all(
            from(doc in CMS.Model.DocsTrashedArticle,
              where: doc.trash_action_id == ^action.id,
              order_by: doc.article_id
            )
          )
          |> Enum.map(&Map.take(&1, @trash_doc_snapshot_fields))

        %{action: Map.take(action, [:root_type, :root_ref]), nodes: nodes, docs: docs}
    end
  end
end
