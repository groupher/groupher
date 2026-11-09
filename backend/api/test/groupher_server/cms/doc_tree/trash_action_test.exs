defmodule GroupherServer.Test.CMS.DocTree.TrashAction do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Activity, CMS}

  alias CMS.Model.{
    Community,
    DocsSiteState,
    DocTreeNode,
    TrashAction,
    TrashedDocArticle,
    TrashedDocTreeNode
  }

  alias Activity.Model.DocTreeLog
  alias CMS.ArtimentMentions.Config
  alias CMS.Model.Mentions.{Edge, Endpoint}

  test "deleting and restoring a published Page moves both Tree stages as one action" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

    {:ok, group} =
      CMS.DocTree.create_group_internal(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Guides",
        slug: "guides",
        base_revision: state.tree_lock_version
      })

    {:ok, page} =
      CMS.DocTree.create_page_internal(
        community,
        %{
          parent_node_id: group.node.id,
          title: "Install",
          slug: "install",
          base_revision: group.revision
        },
        user
      )

    assert {:ok, %{done: true}} =
             CMS.DocTree.publish_changes(community, %{}, user, command_id: Ecto.UUID.generate())

    {:ok, tree} = CMS.DocTree.read(community)

    assert {:ok, deleted} =
             CMS.DocTree.delete_node_internal(community, page.node.id, %{
               base_revision: tree.revision,
               actor_id: user.id
             })

    refute tree_node_exists?(community, page.node.id, :draft)
    refute tree_node_exists?(community, page.node.id, :public)

    membership =
      Repo.get_by!(TrashedDocArticle, article_id: page.node.doc_id)

    assert {:ok, %{entries: [trash_item]}} = CMS.DocTree.trash_items(community, nil, actor: user)

    assert {:ok, %{entries: [cursor_item], end_cursor: cursor, has_next_page: false}} =
             CMS.DocTree.trash_items(community, %{cursor: %{first: 1}}, actor: user)

    assert cursor_item.id == trash_item.id

    assert {:ok, %{entries: []}} =
             CMS.DocTree.trash_items(community, %{cursor: %{first: 1, after: cursor}},
               actor: user
             )

    action = Repo.get_by!(TrashAction, hash_id: trash_item.id)
    item = Repo.get_by!(TrashedDocTreeNode, trash_action_id: action.id, node_id: page.node.id)
    assert item.draft_snapshot
    assert item.public_snapshot
    assert Repo.get(CMS.Model.Article, page.node.doc_id)
    assert {:error, _} = CMS.Docs.read_editor_head(community, page.node.doc_id)

    assert {:error,
            %ErrorCat.Error{
              reason: :custom,
              details: "Trash action must be restored as one group"
            }} =
             CMS.Articles.restore_trashed(membership.hash_id, user)

    assert {:ok, restored} =
             CMS.DocTree.restore_trash_item_internal(community, trash_item.id, %{
               base_revision: deleted.revision,
               actor_id: user.id,
               actor: user
             })

    assert restored.node.id == page.node.id
    assert tree_node_exists?(community, page.node.id, :draft)
    assert tree_node_exists?(community, page.node.id, :public)
    refute Repo.get(TrashAction, action.id)
    assert {:ok, _doc} = CMS.Docs.read_editor_head(community, page.node.doc_id)
  end

  test "deleting an unpublished Page stores and restores only the draft placement" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

    {:ok, group} =
      CMS.DocTree.create_group_internal(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Drafts",
        slug: "drafts",
        base_revision: state.tree_lock_version
      })

    {:ok, page} =
      CMS.DocTree.create_page_internal(
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
             CMS.DocTree.delete_node_internal(community, page.node.id, %{
               base_revision: page.revision,
               actor_id: user.id
             })

    assert {:ok, %{entries: [trash_item]}} = CMS.DocTree.trash_items(community, nil, actor: user)
    action = Repo.get_by!(TrashAction, hash_id: trash_item.id)
    item = Repo.get_by!(TrashedDocTreeNode, trash_action_id: action.id, node_id: page.node.id)
    assert item.draft_snapshot
    refute item.public_snapshot

    assert {:ok, _restored} =
             CMS.DocTree.restore_trash_item_internal(community, trash_item.id, %{
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
      CMS.DocTree.create_group_internal(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Guides",
        slug: "guides",
        base_revision: state.tree_lock_version
      })

    {:ok, first} =
      CMS.DocTree.create_page_internal(
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
      CMS.DocTree.create_page_internal(
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
        CMS.DocTree.delete_node_internal(community, group.node.id, %{
          base_revision: second.revision,
          actor_id: user.id
        })
      end)

    assert Enum.count(queries, &String.contains?(&1, "WITH RECURSIVE subtree")) == 1
    assert trash_snapshot_insert_query_count(queries) == 1

    assert {:ok, %{entries: [trash_item]}} = CMS.DocTree.trash_items(community, nil, actor: user)
    action = Repo.get_by!(TrashAction, hash_id: trash_item.id)

    assert Repo.aggregate(
             from(item in TrashedDocTreeNode, where: item.trash_action_id == ^action.id),
             :count
           ) == 3

    assert Repo.aggregate(
             from(item in TrashedDocArticle, where: item.trash_action_id == ^action.id),
             :count
           ) == 2

    assert Repo.aggregate(
             from(log in DocTreeLog, where: log.operation_ref == ^action.hash_id),
             :count
           ) == 1

    assert Repo.get_by!(DocTreeLog, operation_ref: action.hash_id).action == :trashed

    assert {:ok, _} =
             CMS.DocTree.restore_trash_item_internal(community, trash_item.id, %{
               base_revision: deleted.revision,
               actor_id: user.id
             })

    assert tree_node_exists?(community, group.node.id, :draft)
    assert tree_node_exists?(community, first.node.id, :draft)
    assert tree_node_exists?(community, second.node.id, :draft)
    assert {:ok, _} = CMS.Docs.read_editor_head(community, first.node.doc_id)
    assert {:ok, _} = CMS.Docs.read_editor_head(community, second.node.doc_id)
    assert {:ok, %{entries: []}} = CMS.DocTree.trash_items(community, nil, actor: user)
  end

  test "scheduler permanently deletes a due Link-only action and stale retries are idempotent" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

    {:ok, group} =
      CMS.DocTree.create_group_internal(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Links",
        slug: "links",
        base_revision: state.tree_lock_version
      })

    {:ok, link} =
      CMS.DocTree.create_link_internal(community, %{
        parent_node_id: group.node.id,
        title: "Reference",
        slug: "reference",
        href: "https://example.com/reference",
        base_revision: group.revision
      })

    assert {:ok, _deleted} =
             CMS.DocTree.delete_node_internal(community, link.node.id, %{
               base_revision: link.revision,
               actor_id: user.id
             })

    assert {:ok, %{entries: [trash_item]}} = CMS.DocTree.trash_items(community, nil, actor: user)
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
    refute Repo.get_by(TrashedDocArticle, trash_action_id: action.id)

    assert Repo.get_by(DocTreeLog,
             action: :permanently_deleted,
             operation_ref: action.hash_id,
             source: :scheduler
           )

    assert {:ok, %{done: true}} = CMS.Trash.permanently_delete_action(action, user)
  end

  test "permanently deleting a Docs Tree Trash action uses the receipt command" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

    {:ok, group} =
      CMS.DocTree.create_group_internal(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "References",
        slug: "references",
        base_revision: state.tree_lock_version
      })

    {:ok, link} =
      CMS.DocTree.create_link_internal(community, %{
        parent_node_id: group.node.id,
        title: "Reference",
        slug: "reference",
        href: "https://example.com/reference",
        base_revision: group.revision
      })

    assert {:ok, _deleted} =
             CMS.DocTree.delete_node_internal(community, link.node.id, %{
               base_revision: link.revision,
               actor_id: user.id
             })

    assert {:ok, %{entries: [trash_item]}} = CMS.DocTree.trash_items(community, nil, actor: user)
    action = Repo.get_by!(TrashAction, hash_id: trash_item.id)
    assert action.community_id == community.id
    assert {:ok, :doc} = CMS.Trash.action_thread(action)
    command_id = Ecto.UUID.generate()

    assert {:ok, %{done: true, command_id: ^command_id}} =
             CMS.Trash.permanently_delete_action_in_scope(
               trash_item.id,
               community.id,
               :doc,
               user,
               command_id: command_id
             )

    refute Repo.get(TrashAction, action.id)
    refute Repo.get_by(TrashedDocTreeNode, trash_action_id: action.id)
  end

  test "duplicating a Page creates an independent Doc" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {_, target, _, _} = mock_article(:blog, community, user)
    {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

    {:ok, group} =
      CMS.DocTree.create_group_internal(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Guides",
        slug: "guides",
        base_revision: state.tree_lock_version
      })

    {:ok, page} =
      CMS.DocTree.create_page_internal(
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
              "type" => "a",
              "url" => "#{Config.site_host()}/blog/#{target.id}",
              "children" => [%{"text" => "target link text"}]
            }
          ]
        }
      ])

    {:ok, current} = CMS.Docs.read_editor_head(community, page.node.doc_id)

    assert {:ok, _original_draft} =
             CMS.DocTree.update_draft(
               community,
               page.node.doc_id,
               %{body_bag: mock_body_bag(body), expected_version: current.version},
               user
             )

    {:ok, duplicate} =
      CMS.DocTree.duplicate_node_internal(community, page.node.id, %{
        base_revision: page.revision,
        actor_id: user.id
      })

    assert duplicate.node.id != page.node.id
    assert duplicate.node.doc_id != page.node.doc_id

    {:ok, original_doc} = CMS.Docs.read_editor_head(community, page.node.doc_id)
    {:ok, copied_doc} = CMS.Docs.read_editor_head(community, duplicate.node.doc_id)

    assert original_doc.body.json == copied_doc.body.json

    for doc <- [original_doc, copied_doc] do
      case Repo.get_by(Endpoint,
             type: :doc,
             article_id: doc.article_id
           ) do
        %Endpoint{id: endpoint_id} ->
          refute Repo.exists?(
                   from(edge in Edge,
                     where: edge.source_endpoint_id == ^endpoint_id
                   )
                 )

        nil ->
          :ok
      end
    end
  end

  test "restore requires and accepts a replacement parent when the original parent is gone" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)

    {:ok, original_parent} =
      CMS.DocTree.create_group_internal(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Original",
        base_revision: state.tree_lock_version
      })

    {:ok, child} =
      CMS.DocTree.create_group_internal(community, %{
        parent_node_id: original_parent.node.id,
        title: "Nested",
        base_revision: original_parent.revision
      })

    {:ok, target_parent} =
      CMS.DocTree.create_group_internal(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Target",
        base_revision: child.revision
      })

    {:ok, child_deleted} =
      CMS.DocTree.delete_node_internal(community, child.node.id, %{
        base_revision: target_parent.revision,
        actor_id: user.id
      })

    {:ok, %{entries: [child_trash_item]}} = CMS.DocTree.trash_items(community, nil, actor: user)

    {:ok, parent_deleted} =
      CMS.DocTree.delete_node_internal(community, original_parent.node.id, %{
        base_revision: child_deleted.revision,
        actor_id: user.id
      })

    assert {:error,
            %ErrorCat.Error{
              reason: :custom,
              details:
                "The original Docs Tree parent no longer exists; select a new parent before restoring."
            }} =
             CMS.DocTree.restore_trash_item_internal(community, child_trash_item.id, %{
               base_revision: parent_deleted.revision,
               actor_id: user.id
             })

    assert {:ok, restored} =
             CMS.DocTree.restore_trash_item_internal(community, child_trash_item.id, %{
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
