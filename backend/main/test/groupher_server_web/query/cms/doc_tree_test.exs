defmodule GroupherServer.Test.Query.CMS.DocTree do
  @moduledoc false

  use GroupherServer.TestMate

  @query """
  query($community: String!) {
    docTree(community: $community) {
      revision
      groups {
        id
      }
    }
  }
  """

  setup do
    guest_conn = simu_conn(:guest)
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, tree_state} = ORM.find_by(CMS.Model.DocTreeDraftState, community_id: community.id)

    {:ok, group_payload} =
      CMS.DocTree.create_group(community, %{
        title: "Guides",
        slug: "guides",
        base_revision: tree_state.revision
      })

    user_conn = simu_conn(:user, user)

    {:ok,
     %{
       guest_conn: guest_conn,
       user_conn: user_conn,
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
    assert length(result["groups"]) == 1
  end

  defp empty_docs_community(user) do
    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

    with {:ok, community} <- CMS.Communities.create(community_attrs, user),
         {:ok, _} <- CMS.DocTree.delete_demo_template(community) do
      {:ok, community}
    end
  end
end
