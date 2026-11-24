defmodule GroupherServer.Test.CMS.Articles.DocTrashAcceptanceTest do
  use GroupherServer.TestMate, async: false

  @moduletag sandbox_isolation: "REPEATABLE READ"

  import Ecto.Query
  alias GroupherServer.{CMS, Pagi}
  alias CMS.DocTree.CommunityTrashQuery

  alias CMS.Model.{
    CommunityAdmin,
    DocsPublishQueue,
    DocsQueueTreeChange,
    DocsTrashedArticle,
    DocsTrashedTreeNode,
    DocsTreeNode,
    TrashAction
  }

  test "multiple deleted folders with equal timestamps page without omission or repetition" do
    {community, actor, owner, _queue} = context()
    timestamp = DateTime.utc_now(:second)
    actions = for index <- 1..5, do: group(community, owner, timestamp, "Folder #{index}")
    expected = actions |> Enum.sort_by(& &1.id, :desc) |> Enum.map(& &1.hash_id)

    pages =
      for number <- 1..3 do
        {:ok, pagi} = Pagi.from_input(%{offset: %{page: number, size: 2}})
        assert {:ok, page} = CommunityTrashQuery.page(community, actor, pagi)
        assert page.total_count == 5
        page
      end

    actual = Enum.flat_map(pages, fn page -> Enum.map(page.entries, & &1.id) end)
    assert actual == expected
    assert length(Enum.uniq(actual)) == 5
    assert Enum.map(pages, & &1.has_next_page) == [true, true, false]

    {cursor_ids, _cursor} =
      Enum.reduce(1..3, {[], nil}, fn number, {ids, cursor} ->
        {:ok, pagi} = Pagi.from_input(%{cursor: %{first: 2, after: cursor}})
        assert {:ok, page} = CommunityTrashQuery.page(community, actor, pagi)
        assert page.has_next_page == number < 3
        {ids ++ Enum.map(page.entries, & &1.id), page.end_cursor}
      end)

    assert cursor_ids == expected

    {:ok, other} = mock_community(owner)
    group(other, owner, timestamp, "Other site")
    {:ok, pagi} = Pagi.from_input(%{offset: %{page: 1, size: 20}})
    assert {:ok, page} = CommunityTrashQuery.page(community, actor, pagi)
    assert MapSet.new(Enum.map(page.entries, & &1.id)) == MapSet.new(expected)
  end

  test "mixed pending and removed pages retain counts and member identity across page boundaries" do
    {community, actor, owner, queue} = context()
    timestamp = DateTime.utc_now(:second)
    action = group(community, owner, timestamp, "Mixed folder")

    docs = for _ <- 1..3, do: elem(mock_article(:doc, community, owner), 1)

    members =
      for {doc, index} <- Enum.with_index(docs, 1) do
        node_id = "member-#{Ecto.UUID.generate()}"

        snapshot = %{
          "title" => "Page #{index}",
          "parent_node_id" => action.root_ref,
          "index" => index
        }

        Repo.insert!(
          DocsTrashedTreeNode.changeset(%DocsTrashedTreeNode{}, %{
            trash_action_id: action.id,
            community_id: community.id,
            node_id: node_id,
            doc_id: doc.id,
            type: :page,
            draft_snapshot: snapshot,
            public_snapshot: snapshot,
            deleted_at: timestamp
          })
        )

        member =
          Repo.insert!(
            DocsTrashedArticle.changeset(%DocsTrashedArticle{}, %{
              trash_action_id: action.id,
              community_id: community.id,
              article_id: doc.id,
              restore_state: :published,
              deleted_at: timestamp
            })
          )

        if index == 1 do
          unless Repo.exists?(
                   from(n in DocsTreeNode,
                     where:
                       n.community_id == ^community.id and n.stage == :public and
                         n.doc_id == ^doc.id
                   )
                 ) do
            Repo.insert!(
              DocsTreeNode.changeset(%DocsTreeNode{}, %{
                community_id: community.id,
                node_id: node_id,
                stage: :public,
                doc_id: doc.id,
                type: :page,
                title: "Page #{index}",
                index: 100 + index
              })
            )
          end

          Repo.insert!(
            DocsQueueTreeChange.changeset(%DocsQueueTreeChange{}, %{
              queue_id: queue.id,
              community_id: community.id,
              node_id: node_id,
              change_type: :delete
            })
          )
        else
          Repo.delete_all(
            from(n in DocsTreeNode,
              where:
                n.community_id == ^community.id and n.stage == :public and n.doc_id == ^doc.id
            )
          )
        end

        member
      end

    assert {:ok, item} = CommunityTrashQuery.get(community, actor, action.hash_id)
    assert item.pending_member_count == 1
    assert item.removed_member_count == 2
    assert item.status == :effective

    query = """
    query DocTrashAcceptance($community: String!) {
      communityArticleTrashItems(communityRef: $community, thread: DOC,
        pagi: {offset: {page: 1, size: 2}}) {
        entries {
          id
          ... on CommunityDocTreeTrashItem {
            pagedMembers(pagi: {offset: {page: 1, size: 2}}) {
              entries { id deletionStatus removedFromPublic }
              pageInfo { hasNextPage }
            }
          }
        }
      }
    }
    """

    assert {:ok, %{data: %{"communityArticleTrashItems" => %{"entries" => [projected]}}}} =
             Absinthe.run(query, GroupherServerWeb.Schema,
               variables: %{"community" => community.slug},
               context: %{cur_user: actor}
             )

    assert projected["id"] == action.hash_id

    assert projected["pagedMembers"]["entries"] == [
             %{
               "id" => Enum.at(members, 0).hash_id,
               "deletionStatus" => "PENDING",
               "removedFromPublic" => false
             },
             %{
               "id" => Enum.at(members, 1).hash_id,
               "deletionStatus" => "EFFECTIVE",
               "removedFromPublic" => true
             }
           ]

    assert projected["pagedMembers"]["pageInfo"]["hasNextPage"]

    pages =
      for number <- 1..2 do
        {:ok, pagi} = Pagi.from_input(%{offset: %{page: number, size: 2}})

        assert {:ok, page} =
                 CommunityTrashQuery.members(
                   community,
                   actor,
                   action.hash_id,
                   item.record_revision,
                   pagi
                 )

        assert page.total_count == 3
        page
      end

    entries = Enum.flat_map(pages, & &1.entries)
    assert Enum.map(entries, & &1.id) == Enum.map(members, & &1.hash_id)
    assert Enum.map(entries, & &1.deletion_status) == [:pending, :effective, :effective]
    assert Enum.map(entries, & &1.removed_from_public) == [false, true, true]
    assert Enum.map(pages, & &1.has_next_page) == [true, false]
  end

  defp context do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    {:ok, actor} = db_insert(:user)

    Repo.insert!(
      CommunityAdmin.changeset(%CommunityAdmin{}, %{
        user_id: actor.id,
        community_id: community.id,
        permissions: %{"community.article.trash.read" => true}
      })
    )

    queue = Repo.insert!(Ecto.Changeset.change(%DocsPublishQueue{}, community_id: community.id))
    {community, actor, owner, queue}
  end

  defp group(community, owner, timestamp, title) do
    node_id = "group-#{Ecto.UUID.generate()}"

    action =
      Repo.insert!(
        TrashAction.changeset(%TrashAction{}, %{
          community_id: community.id,
          actor_id: owner.id,
          root_type: "doc_tree_node",
          root_ref: node_id,
          deleted_at: timestamp,
          scheduled_permanent_deletion_at: DateTime.add(timestamp, 30, :day)
        })
      )

    Repo.insert!(
      DocsTrashedTreeNode.changeset(%DocsTrashedTreeNode{}, %{
        trash_action_id: action.id,
        community_id: community.id,
        node_id: node_id,
        type: :group,
        draft_snapshot: %{"title" => title, "parent_node_id" => nil, "index" => 0},
        deleted_at: timestamp
      })
    )

    action
  end
end
