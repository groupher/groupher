defmodule GroupherServer.Test.Query.CMS.DocTree do
  @moduledoc false

  use GroupherServer.TestMate

  @query S.DocTree.q(:doc_tree)

  @public_query S.DocTree.q(:doc_public_tree)
  @trash_query S.DocTree.q(:doc_tree_trash_items)
  @delete_mutation S.DocTree.m(:delete_doc_tree_node)
  @restore_mutation S.DocTree.m(:restore_doc_tree_trash_item)

  setup do
    guest_conn = simu_conn(:guest)
    {:ok, user} = db_insert(:user)
    {:ok, member} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, tree_state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)

    {:ok, group_payload} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Guides",
        slug: "guides",
        base_revision: tree_state.tree_lock_version
      })

    user_conn = simu_conn(:user, user)
    member_conn = simu_conn(:user, member)

    {:ok,
     %{
       guest_conn: guest_conn,
       user_conn: user_conn,
       member_conn: member_conn,
       user: user,
       community: community,
       group_payload: group_payload
     }}
  end

  test "doc_tree requires login", %{guest_conn: guest_conn, community: community} do
    assert guest_conn
           |> query_error?(
             @query,
             %{community: community.slug},
             ErrorCat.code(GroupherServer.Accounts.Profiles.ErrorCat.account_login())
           )
  end

  test "authorized user can query doc_tree", %{
    user_conn: user_conn,
    community: community,
    group_payload: group_payload
  } do
    result = user_conn |> gq_query(@query, %{community: community.slug})

    assert result["revision"] == group_payload.revision
    assert result["treeState"]["hasUnpublishedChanges"] == true
    assert result["treeState"]["stagedEventCount"] == 1
    assert Enum.all?(result["stagedEvents"], &(&1["eventType"] == "node.create"))
    assert [%{"pins" => [], "groups" => [%{"type" => "GROUP"}]}] = result["tabs"]
  end

  test "logged-in user without passport can delete, list, and restore a trash item", %{
    member_conn: member_conn,
    user: user,
    community: community,
    group_payload: group_payload
  } do
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

    delete_variables = %{
      community: community.slug,
      id: page_payload.node.id,
      baseRevision: page_payload.revision
    }

    deleted = member_conn |> gq_mutation(@delete_mutation, delete_variables)

    assert deleted["conflict"] == false

    assert [trash_item] =
             member_conn |> gq_query(@trash_query, %{community: community.slug})

    assert trash_item["nodeId"] == page_payload.node.id
    assert trash_item["type"] == "page"
    assert trash_item["title"] == "Install"
    assert trash_item["restoredAt"] == nil

    restore_variables = %{
      community: community.slug,
      id: trash_item["id"],
      baseRevision: deleted["revision"]
    }

    restored = member_conn |> gq_mutation(@restore_mutation, restore_variables)

    assert restored["conflict"] == false
    assert restored["node"]["id"] == page_payload.node.id
    assert restored["node"]["type"] == "PAGE"
    assert restored["node"]["title"] == "Install"
    assert [] = member_conn |> gq_query(@trash_query, %{community: community.slug})
  end

  test "doc tree trash requires login", %{guest_conn: guest_conn, community: community} do
    assert guest_conn
           |> query_error?(
             @trash_query,
             %{community: community.slug},
             ErrorCat.code(GroupherServer.Accounts.Profiles.ErrorCat.account_login())
           )
  end

  test "guest can query doc_public_tree without seeing drafts", %{
    guest_conn: guest_conn,
    community: community
  } do
    result = guest_conn |> gq_query(@public_query, %{community: community.slug})

    assert result["tabs"] == []
  end

  test "guest can query published doc_public_tree", %{
    guest_conn: guest_conn,
    user: user,
    community: community,
    group_payload: group_payload
  } do
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

    result = guest_conn |> gq_query(@public_query, %{community: community.slug})

    group_node_id = group_payload.node.id
    page_node_id = page_payload.node.id
    page_doc_id = page_payload.node.doc_id
    expected_href = "/#{community.slug}/doc/1/install"

    assert [
             %{
               "groups" => [
                 %{
                   "id" => ^group_node_id,
                   "title" => "Guides",
                   "pages" => [
                     %{
                       "id" => ^page_node_id,
                       "docId" => ^page_doc_id,
                       "type" => "PAGE",
                       "title" => "Install",
                       "href" => ^expected_href
                     }
                   ]
                 }
               ]
             }
           ] = result["tabs"]
  end

  defp empty_docs_community(user), do: create_empty_docs_community(user)
end
