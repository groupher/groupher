defmodule GroupherServer.Test.CMS.DocTree.TrashAction do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias CMS.Model.{
    Community,
    AuditLog,
    Doc,
    DocsSiteState,
    DocTreeNode,
    TrashAction,
    TrashedArticle,
    TrashedDocTreeNode
  }

  test "deleting and restoring a published Page moves both Tree stages as one action" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

    {:ok, group} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Guides",
        slug: "guides",
        base_revision: state.tree_lock_version
      })

    {:ok, page} =
      CMS.DocTree.create_page(
        community,
        %{
          parent_node_id: group.node.id,
          title: "Install",
          slug: "install",
          base_revision: group.revision
        },
        user
      )

    assert {:ok, %{done: true}} = CMS.DocTree.publish_changes(community, %{}, user)
    {:ok, tree} = CMS.DocTree.read(community)

    assert {:ok, deleted} =
             CMS.DocTree.delete_node(community, page.node.id, %{
               base_revision: tree.revision,
               actor_id: user.id
             })

    refute tree_node_exists?(community, page.node.id, :draft)
    refute tree_node_exists?(community, page.node.id, :public)

    membership =
      Repo.get_by!(TrashedArticle, article_hash_id: page.node.doc_id, thread: :doc)

    assert {:ok, [trash_item]} = CMS.DocTree.trash_items(community, actor: user)
    action = Repo.get_by!(TrashAction, hash_id: trash_item.id)
    item = Repo.get_by!(TrashedDocTreeNode, trash_action_id: action.id, node_id: page.node.id)
    assert item.draft_snapshot
    assert item.public_snapshot
    assert Repo.get_by(Doc, article_hash_id: page.node.doc_id)
    assert {:error, _} = CMS.Articles.read_editor(community, :doc, page.node.doc_id)

    assert {:error, {:custom, "Trash action must be restored as one group"}} =
             CMS.Articles.restore_trashed(membership, user)

    assert {:ok, restored} =
             CMS.DocTree.restore_trash_item(community, trash_item.id, %{
               base_revision: deleted.revision,
               actor_id: user.id
             })

    assert restored.node.id == page.node.id
    assert tree_node_exists?(community, page.node.id, :draft)
    assert tree_node_exists?(community, page.node.id, :public)
    refute Repo.get(TrashAction, action.id)
    assert {:ok, _doc} = CMS.Articles.read_editor(community, :doc, page.node.doc_id)
  end

  test "deleting an unpublished Page stores and restores only the draft placement" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

    {:ok, group} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Drafts",
        slug: "drafts",
        base_revision: state.tree_lock_version
      })

    {:ok, page} =
      CMS.DocTree.create_page(
        community,
        %{
          parent_node_id: group.node.id,
          title: "Unpublished",
          slug: "unpublished",
          base_revision: group.revision
        },
        user
      )

    assert {:ok, deleted} =
             CMS.DocTree.delete_node(community, page.node.id, %{
               base_revision: page.revision,
               actor_id: user.id
             })

    assert {:ok, [trash_item]} = CMS.DocTree.trash_items(community, actor: user)
    action = Repo.get_by!(TrashAction, hash_id: trash_item.id)
    item = Repo.get_by!(TrashedDocTreeNode, trash_action_id: action.id, node_id: page.node.id)
    assert item.draft_snapshot
    refute item.public_snapshot

    assert {:ok, _restored} =
             CMS.DocTree.restore_trash_item(community, trash_item.id, %{
               base_revision: deleted.revision,
               actor_id: user.id
             })

    assert tree_node_exists?(community, page.node.id, :draft)
    refute tree_node_exists?(community, page.node.id, :public)
  end

  test "deleting a Group exposes one action and restores all child Pages together" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

    {:ok, group} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Guides",
        slug: "guides",
        base_revision: state.tree_lock_version
      })

    {:ok, first} =
      CMS.DocTree.create_page(
        community,
        %{
          parent_node_id: group.node.id,
          title: "Install",
          slug: "install",
          base_revision: group.revision
        },
        user
      )

    {:ok, second} =
      CMS.DocTree.create_page(
        community,
        %{
          parent_node_id: group.node.id,
          title: "Configure",
          slug: "configure",
          base_revision: first.revision
        },
        user
      )

    {{:ok, deleted}, queries} =
      capture_repo_queries(fn ->
        CMS.DocTree.delete_node(community, group.node.id, %{
          base_revision: second.revision,
          actor_id: user.id
        })
      end)

    assert Enum.count(queries, &String.contains?(&1, "WITH RECURSIVE subtree")) == 1
    assert trash_snapshot_insert_query_count(queries) == 1

    assert {:ok, [trash_item]} = CMS.DocTree.trash_items(community, actor: user)
    action = Repo.get_by!(TrashAction, hash_id: trash_item.id)

    assert Repo.aggregate(
             from(item in TrashedDocTreeNode, where: item.trash_action_id == ^action.id),
             :count
           ) == 3

    assert Repo.aggregate(
             from(item in TrashedArticle, where: item.trash_action_id == ^action.id),
             :count
           ) == 2

    assert Repo.aggregate(
             from(log in AuditLog, where: log.operation_ref == ^action.hash_id),
             :count
           ) == 1

    assert Repo.get_by!(AuditLog, operation_ref: action.hash_id).action == "doc_tree.trashed"

    assert {:ok, _} =
             CMS.DocTree.restore_trash_item(community, trash_item.id, %{
               base_revision: deleted.revision,
               actor_id: user.id
             })

    assert tree_node_exists?(community, group.node.id, :draft)
    assert tree_node_exists?(community, first.node.id, :draft)
    assert tree_node_exists?(community, second.node.id, :draft)
    assert {:ok, _} = CMS.Articles.read_editor(community, :doc, first.node.doc_id)
    assert {:ok, _} = CMS.Articles.read_editor(community, :doc, second.node.doc_id)
    assert {:ok, []} = CMS.DocTree.trash_items(community, actor: user)
  end

  test "scheduler permanently deletes a due Link-only action and stale retries are idempotent" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

    {:ok, group} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Links",
        slug: "links",
        base_revision: state.tree_lock_version
      })

    {:ok, link} =
      CMS.DocTree.create_link(community, %{
        parent_node_id: group.node.id,
        title: "Reference",
        slug: "reference",
        href: "https://example.com/reference",
        base_revision: group.revision
      })

    assert {:ok, _deleted} =
             CMS.DocTree.delete_node(community, link.node.id, %{
               base_revision: link.revision,
               actor_id: user.id
             })

    assert {:ok, [trash_item]} = CMS.DocTree.trash_items(community, actor: user)
    action = Repo.get_by!(TrashAction, hash_id: trash_item.id)

    assert {:ok, action} =
             action
             |> Ecto.Changeset.change(%{
               scheduled_permanent_deletion_at: DateTime.utc_now(:second)
             })
             |> Repo.update()

    assert {:ok, %{deleted: 1, failed: []}} =
             CMS.Trash.purge_due(now: DateTime.utc_now(:second), size: 10)

    refute Repo.get(TrashAction, action.id)
    refute Repo.get_by(TrashedDocTreeNode, trash_action_id: action.id)
    refute Repo.get_by(TrashedArticle, trash_action_id: action.id)

    assert Repo.get_by(AuditLog,
             action: "doc_tree.permanently_deleted",
             operation_ref: action.hash_id,
             source: "scheduler"
           )

    assert {:ok, %{done: true}} = CMS.Trash.permanently_delete_action(action, user)
  end

  test "duplicating a Page creates an independent Doc" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {_, target, _, _} = mock_article(:blog, community, user)
    {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

    {:ok, group} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Guides",
        slug: "guides",
        base_revision: state.tree_lock_version
      })

    {:ok, page} =
      CMS.DocTree.create_page(
        community,
        %{
          parent_node_id: group.node.id,
          title: "Install",
          slug: "install",
          base_revision: group.revision
        },
        user
      )

    body =
      Jason.encode!([
        %{
          "type" => "p",
          "id" => "copied-mention",
          "children" => [
            %{
              "text" =>
                ~s(<a href="#{GroupherServer.CMS.ArtimentMentions.Config.site_host()}/blog/#{target.id}">target</a>)
            }
          ]
        }
      ])

    assert {:ok, original_draft} =
             CMS.DocTree.update_draft(
               community,
               page.node.doc_id,
               %{body_bag: mock_body_bag(body)},
               user
             )

    assert {:ok, {1, nil}} = CMS.ArtimentMentions.sync(original_draft)

    {:ok, duplicate} =
      CMS.DocTree.duplicate_node(community, page.node.id, %{
        base_revision: page.revision,
        actor_id: user.id
      })

    assert duplicate.node.id != page.node.id
    assert duplicate.node.doc_id != page.node.doc_id

    {:ok, original_doc} = CMS.Articles.read_editor(community, :doc, page.node.doc_id)
    {:ok, copied_doc} = CMS.Articles.read_editor(community, :doc, duplicate.node.doc_id)

    assert Repo.preload(original_doc, :document).document.json ==
             Repo.preload(copied_doc, :document).document.json

    assert Repo.get_by(CMS.Model.ArtimentMention,
             mentioner_type: :doc,
             mentioner_id: original_doc.id,
             mentioned_type: :blog,
             mentioned_id: target.id
           )

    assert Repo.get_by(CMS.Model.ArtimentMention,
             mentioner_type: :doc,
             mentioner_id: copied_doc.id,
             mentioned_type: :blog,
             mentioned_id: target.id
           )
  end

  test "restore requires and accepts a replacement parent when the original parent is gone" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

    {:ok, original_parent} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Original",
        base_revision: state.tree_lock_version
      })

    {:ok, child} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: original_parent.node.id,
        title: "Nested",
        base_revision: original_parent.revision
      })

    {:ok, target_parent} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Target",
        base_revision: child.revision
      })

    {:ok, child_deleted} =
      CMS.DocTree.delete_node(community, child.node.id, %{
        base_revision: target_parent.revision,
        actor_id: user.id
      })

    {:ok, [child_trash_item]} = CMS.DocTree.trash_items(community, actor: user)

    {:ok, parent_deleted} =
      CMS.DocTree.delete_node(community, original_parent.node.id, %{
        base_revision: child_deleted.revision,
        actor_id: user.id
      })

    assert {:error,
            {:custom,
             "The original Docs Tree parent no longer exists; select a new parent before restoring."}} =
             CMS.DocTree.restore_trash_item(community, child_trash_item.id, %{
               base_revision: parent_deleted.revision,
               actor_id: user.id
             })

    assert {:ok, restored} =
             CMS.DocTree.restore_trash_item(community, child_trash_item.id, %{
               base_revision: parent_deleted.revision,
               actor_id: user.id,
               target_parent_node_id: target_parent.node.id,
               target_index: 0
             })

    assert restored.node.parent_node_id == target_parent.node.id
  end

  defp empty_docs_community(user), do: create_empty_docs_community(user)

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

  defp trash_snapshot_insert_query_count(queries) do
    Enum.count(queries, fn query ->
      query
      |> String.trim_leading()
      |> String.starts_with?(~s(INSERT INTO "cms"."trashed_doc_tree_nodes"))
    end)
  end

  defp tree_node_exists?(community, node_id, stage) do
    DocTreeNode
    |> where([node], node.community_id == ^community.id)
    |> where([node], node.node_id == ^node_id and node.stage == ^stage)
    |> Repo.exists?()
  end
end
