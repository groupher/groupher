defmodule GroupherServer.Test.Query.CMS.DocTree do
  @moduledoc false

  use GroupherServer.TestMate

  @query """
  query($community: String!) {
    docTree(community: $community) {
      revision
      treeState {
        hasUnpublishedChanges
        stagedEventCount
      }
      stagedEvents {
        eventType
      }
      groups {
        id
      }
      pins {
        id
        type
        title
        href
      }
    }
  }
  """

  @public_query """
  query($community: String!) {
    docPublicTree(community: $community) {
      groups {
        id
        title
        children {
          id
          docId
          type
          title
          href
        }
      }
    }
  }
  """

  setup do
    guest_conn = simu_conn(:guest)
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, tree_state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)

    {:ok, group_payload} =
      CMS.DocTree.create_group(community, %{
        title: "Guides",
        slug: "guides",
        base_revision: tree_state.tree_lock_version
      })

    user_conn = simu_conn(:user, user)

    {:ok,
     %{
       guest_conn: guest_conn,
       user_conn: user_conn,
       user: user,
       community: community,
       group_payload: group_payload
     }}
  end

  test "doc_tree requires login", %{guest_conn: guest_conn, community: community} do
    assert guest_conn |> query_error?(@query, %{community: community.slug}, ecode(:account_login))
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
    assert [%{"eventType" => "node.create"}] = result["stagedEvents"]
    assert length(result["groups"]) == 1
    assert result["pins"] == []
  end

  test "guest can query doc_public_tree without seeing drafts", %{
    guest_conn: guest_conn,
    community: community
  } do
    result = guest_conn |> gq_query(@public_query, %{community: community.slug})

    assert result["groups"] == []
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
          group_id: group_payload.node.id,
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
               "id" => ^group_node_id,
               "title" => "Guides",
               "children" => [
                 %{
                   "id" => ^page_node_id,
                   "docId" => ^page_doc_id,
                   "type" => "PAGE",
                   "title" => "Install",
                   "href" => ^expected_href
                 }
               ]
             }
           ] = result["groups"]
  end

  defp empty_docs_community(user) do
    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

    with {:ok, community} <- CMS.Communities.create(community_attrs, user),
         {:ok, _} <- CMS.DocTree.delete_demo_template(community) do
      {:ok, community}
    end
  end
end
