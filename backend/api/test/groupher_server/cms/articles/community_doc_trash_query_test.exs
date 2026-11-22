defmodule GroupherServer.Test.CMS.Articles.CommunityDocTrashQueryTest do
  use GroupherServer.TestMate, async: false

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.CMS
  alias CMS.DocTree.CommunityTrashQuery

  alias CMS.Model.{
    CommunityAdmin,
    DocsPublishQueue,
    DocsTrashedTreeNode,
    TrashAction
  }

  alias GroupherServerWeb.Schema

  test "pages one composite Doc item per TrashAction and requires the new read permission" do
    Sandbox.unboxed_run(Repo, fn ->
      {:ok, owner} = db_insert(:user)

      {:ok, community} = mock_community(owner)

      {:ok, actor} = db_insert(:user)
      admin_with_doc_trash_read(community, actor)

      {:ok, queue} =
        %DocsPublishQueue{}
        |> Ecto.Changeset.change(%{community_id: community.id})
        |> Repo.insert()

      deleted_at = DateTime.utc_now(:second)

      {:ok, action} =
        %TrashAction{}
        |> TrashAction.changeset(%{
          community_id: community.id,
          actor_id: owner.id,
          root_type: "doc_tree_node",
          root_ref: "trash-root",
          deleted_at: deleted_at,
          scheduled_permanent_deletion_at: DateTime.add(deleted_at, 30, :day)
        })
        |> Repo.insert()

      {:ok, _} =
        %DocsTrashedTreeNode{}
        |> DocsTrashedTreeNode.changeset(%{
          trash_action_id: action.id,
          community_id: community.id,
          node_id: "trash-root",
          type: :group,
          draft_snapshot: %{
            "title" => "Deleted group",
            "parent_node_id" => nil,
            "index" => 0
          },
          deleted_at: deleted_at
        })
        |> Repo.insert()

      {:ok, pagi} = GroupherServer.Pagi.from_input(nil)
      assert {:ok, page} = CommunityTrashQuery.page(community, actor, pagi)
      assert [%{id: id, thread: :doc, status: :effective} = item] = page.entries
      assert id == action.hash_id
      assert item.title == "Deleted group"
      assert item.pending_member_count == 0
      assert item.removed_member_count == 0
      refute item.public_visible
      assert item.record_revision != ""
      assert [%{node_id: "trash-root", title: "Deleted group"}] = item.tree_path

      {:ok, unauthorized} = db_insert(:user)

      assert {:error, %{reason: :permission_denied}} =
               CommunityTrashQuery.page(community, unauthorized, pagi)

      assert {:ok, detail} = CommunityTrashQuery.get(community, actor, action.hash_id)
      assert detail.id == action.hash_id
      assert {:error, _} = CommunityTrashQuery.get(community, actor, "member-node-id")

      members_query = """
      query DocTrashMembers($communityRef: String!, $id: ID!, $pagi: PagiInput, $revision: String) {
        communityArticleTrash(communityRef: $communityRef, thread: DOC, id: $id) {
          id
          recordRevision
          ... on CommunityDocTreeTrashItem {
            pagedMembers(pagi: $pagi, recordRevision: $revision) {
              entries { id title deletionStatus removedFromPublic }
              pageInfo {
                __typename hasNextPage hasPreviousPage
                ... on OffsetPageInfo { totalCount }
              }
            }
          }
        }
      }
      """

      variables = %{
        "communityRef" => community.slug,
        "id" => action.hash_id,
        "pagi" => %{"offset" => %{"page" => 1, "size" => 20}}
      }

      assert {:ok,
              %{
                data: %{
                  "communityArticleTrash" => %{
                    "id" => id,
                    "pagedMembers" => %{"entries" => [], "pageInfo" => %{"totalCount" => 0}}
                  }
                }
              }} =
               Absinthe.run(members_query, Schema,
                 variables: variables,
                 context: %{cur_user: actor}
               )

      assert id == action.hash_id

      assert {:ok, members} =
               CommunityTrashQuery.members(
                 community,
                 actor,
                 action.hash_id,
                 item.record_revision,
                 pagi
               )

      assert members.entries == []

      changed_queue =
        queue
        |> Ecto.Changeset.change(queue_revision: queue.queue_revision + 1)
        |> Repo.update!()

      assert {:error, _} =
               CommunityTrashQuery.members(
                 community,
                 actor,
                 action.hash_id,
                 item.record_revision,
                 pagi
               )

      assert {:ok, %{errors: [_ | _]}} =
               Absinthe.run(members_query, Schema,
                 variables: Map.put(variables, "revision", item.record_revision),
                 context: %{cur_user: actor}
               )

      Repo.update!(Ecto.Changeset.change(changed_queue, queue_revision: queue.queue_revision))
    end)
  end

  test "public Doc visibility scope includes tree, body, lifecycle and review predicates" do
    context = GroupherServer.CMS.Gate.Context.Scope.Doc.public()
    query = GroupherServer.CMS.Gate.scope(GroupherServer.CMS.Model.Article, nil, :list, context)
    {sql, _params} = Ecto.Adapters.SQL.to_sql(:all, Repo, query)

    assert sql =~ "doc_tree_nodes"
    assert sql =~ "article_public_bodies"
    assert sql =~ "article_review_blocks"
    assert sql =~ "article_lifecycles"
  end

  test "snapshot reader does not acquire site or row write locks" do
    source =
      Path.expand(
        "../../../../lib/groupher_server/cms/doc_tree/community_trash_query.ex",
        __DIR__
      )
      |> File.read!()

    refute source =~ "SiteLock.acquire"
    refute source =~ "FOR UPDATE"
  end

  defp admin_with_doc_trash_read(community, actor) do
    {:ok, _} =
      %CommunityAdmin{}
      |> CommunityAdmin.changeset(%{
        user_id: actor.id,
        community_id: community.id,
        joined_at: DateTime.utc_now(:second),
        permissions: %{"community.article.trash.read" => true}
      })
      |> Repo.insert()
  end
end
