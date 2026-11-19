defmodule GroupherServer.Test.Mutation.CMS.CommunityAdminRequestsTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Model.{CommunityAdmin, CommunityAdminRequest}

  test "Admin GraphQL invite is pending until its subject accepts" do
    {:ok, lord} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, community} = mock_community(lord)
    member = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: lord.id)
    Repo.update!(Ecto.Changeset.change(member, is_lord: true))

    lifecycle =
      Repo.get_by!(GroupherServer.CMS.Model.CommunityLifecycle, community_id: community.id)

    Repo.update!(Ecto.Changeset.change(lifecycle, state: :active))

    allowed =
      gq_query(
        simu_conn(:user, lord),
        "query($ref:String!){communityAdminManagementAllowed(communityRef:$ref)}",
        %{ref: community.slug}
      )

    admins =
      gq_query(
        simu_conn(:user, lord),
        "query($community:String!){pagedCommunityAdmins(community:$community,pagi:{offset:{page:1,size:10}}){entries{memberId revision isLord permissions user{login}} pageInfo{... on OffsetPageInfo{totalCount}}}}",
        %{community: community.slug}
      )

    candidates =
      gq_query(
        simu_conn(:user, lord),
        "query($community:String!,$name:String!){adminCandidates(community:$community,name:$name){login}}",
        %{community: community.slug, name: subject.login}
      )

    assert allowed
    assert Enum.any?(admins["entries"], &(&1["user"]["login"] == lord.login))
    assert Enum.any?(candidates, &(&1["login"] == subject.login))

    create = """
    mutation($community: String!, $type: String!, $login: String!, $permissions: Json!, $commandId: ID!) {
      createCommunityAdminRequest(community: $community, type: $type, subjectLogin: $login,
        permissions: $permissions, commandId: $commandId) { id type status revision }
    }
    """

    invite =
      gq_mutation(simu_conn(:user, lord), create, %{
        community: community.slug,
        type: "invite",
        login: subject.login,
        permissions: Jason.encode!(%{"doc.queue.write" => true}),
        commandId: Ecto.UUID.generate()
      })

    assert invite["type"] == "invite"
    assert invite["status"] == "pending"
    refute Repo.get_by(CommunityAdmin, community_id: community.id, user_id: subject.id)

    requests =
      gq_query(
        simu_conn(:user, lord),
        "query($community:String!){pagedCommunityAdminRequests(community:$community,pagi:{offset:{page:1,size:10}}){entries{id type status revision subjectUser{login} createdBy{login}} pageInfo{... on OffsetPageInfo{totalCount}}}}",
        %{community: community.slug}
      )

    assert Enum.any?(requests["entries"], &(&1["id"] == invite["id"]))

    decide = """
    mutation($id: ID!, $revision: Int!, $commandId: ID!) {
      decideCommunityAdminRequest(requestId: $id, revision: $revision, decision: "accept", commandId: $commandId) {
        id status decision
      }
    }
    """

    accepted =
      gq_mutation(simu_conn(:user, subject), decide, %{
        id: invite["id"],
        revision: invite["revision"],
        commandId: Ecto.UUID.generate()
      })

    assert accepted["status"] == "decided"
    assert accepted["decision"] == "accept"
    assert Repo.get_by(CommunityAdmin, community_id: community.id, user_id: subject.id)

    assert Repo.get!(CommunityAdminRequest, invite["id"]).approved_permissions == %{
             "doc.queue.write" => true
           }

    apply_request =
      gq_mutation(simu_conn(:user, subject), create, %{
        community: community.slug,
        type: "apply",
        login: subject.login,
        permissions: Jason.encode!(%{"doc.queue.write" => true, "doc.queue.publish" => true}),
        commandId: Ecto.UUID.generate()
      })

    assert apply_request["type"] == "apply"
    assert apply_request["status"] == "pending"
  end
end
