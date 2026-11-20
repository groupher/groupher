defmodule GroupherServer.Test.Mutation.CMS.CommunityAdminRequestsTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Model.{CommunityAdmin, CommunityAdminRequest}

  test "Admin GraphQL invite is pending until its subject accepts" do
    {:ok, lord} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, community} = mock_community(lord)

    community_identity =
      gq_query(
        simu_conn(:guest),
        "query($slug:String!){community(slug:$slug){ref slug}}",
        %{slug: community.slug}
      )

    assert community_identity["ref"] == community.ref

    member = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: lord.id)
    Repo.update!(Ecto.Changeset.change(member, is_lord: true))

    lifecycle =
      Repo.get_by!(GroupherServer.CMS.Model.CommunityLifecycle, community_id: community.id)

    Repo.update!(Ecto.Changeset.change(lifecycle, state: :active))

    allowed =
      gq_query(
        simu_conn(:user, lord),
        "query($ref:String!){communityAdminManagementAllowed(communityRef:$ref)}",
        %{ref: community.ref}
      )

    admins =
      gq_query(
        simu_conn(:user, lord),
        "query($communityRef:String!){pagedCommunityAdmins(communityRef:$communityRef,pagi:{offset:{page:1,size:10}}){entries{memberId revision isLord permissions user{login}} pageInfo{... on OffsetPageInfo{totalCount}}}}",
        %{communityRef: community.ref}
      )

    candidates =
      gq_query(
        simu_conn(:user, lord),
        "query($communityRef:String!,$name:String!){adminCandidates(communityRef:$communityRef,name:$name){login}}",
        %{communityRef: community.ref, name: subject.login}
      )

    assert allowed
    assert Enum.any?(admins["entries"], &(&1["user"]["login"] == lord.login))
    assert Enum.any?(candidates, &(&1["login"] == subject.login))

    create = """
    mutation($communityRef: String!, $type: String!, $login: String!, $permissions: Json!, $commandId: ID!) {
      createCommunityAdminRequest(communityRef: $communityRef, type: $type, subjectLogin: $login,
        permissions: $permissions, commandId: $commandId) { id type status revision }
    }
    """

    invite =
      gq_mutation(simu_conn(:user, lord), create, %{
        communityRef: community.ref,
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
        "query($communityRef:String!){pagedCommunityAdminRequests(communityRef:$communityRef,pagi:{offset:{page:1,size:10}}){entries{id type status revision subjectUser{login} createdBy{login}} pageInfo{... on OffsetPageInfo{totalCount}}}}",
        %{communityRef: community.ref}
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

    member = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: subject.id)

    updated_member =
      gq_mutation(
        simu_conn(:user, lord),
        """
        mutation($communityRef: String!, $memberId: ID!, $revision: Int!, $permissions: Json!, $commandId: ID!) {
          updateCommunityAdminPermissions(communityRef: $communityRef, memberId: $memberId,
            revision: $revision, permissions: $permissions, commandId: $commandId) {
            memberId revision isLord permissions user { login }
          }
        }
        """,
        %{
          communityRef: community.ref,
          memberId: member.id,
          revision: member.revision,
          permissions:
            Jason.encode!(%{
              "doc.queue.write" => true,
              "doc.queue.approve" => true
            }),
          commandId: Ecto.UUID.generate()
        }
      )

    assert updated_member["memberId"] == to_string(member.id)
    assert updated_member["revision"] == member.revision + 1
    assert updated_member["permissions"] == ["DOC_QUEUE_APPROVE", "DOC_QUEUE_WRITE"]

    current =
      gq_query(
        simu_conn(:user, subject),
        "query($communityRef: String!){currentCommunityAdmin(communityRef: $communityRef){memberId revision isLord permissions}}",
        %{communityRef: community.ref}
      )

    assert current["memberId"] == to_string(member.id)
    assert current["revision"] == updated_member["revision"]

    apply_request =
      gq_mutation(simu_conn(:user, subject), create, %{
        communityRef: community.ref,
        type: "apply",
        login: subject.login,
        permissions: Jason.encode!(%{"doc.queue.write" => true, "doc.queue.publish" => true}),
        commandId: Ecto.UUID.generate()
      })

    assert apply_request["type"] == "apply"
    assert apply_request["status"] == "pending"

    assert gq_mutation(
             simu_conn(:user, subject),
             "mutation($communityRef: String!, $revision: Int!, $commandId: ID!){leaveCommunityAdmins(communityRef: $communityRef, revision: $revision, commandId: $commandId)}",
             %{
               communityRef: community.ref,
               revision: updated_member["revision"],
               commandId: Ecto.UUID.generate()
             }
           )

    refute Repo.get_by(CommunityAdmin, community_id: community.id, user_id: subject.id)
  end
end
