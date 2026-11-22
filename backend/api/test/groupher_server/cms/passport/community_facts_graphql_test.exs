defmodule GroupherServer.Test.CMS.Passport.CommunityFactsGraphqlTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Model.CommunityAdmin
  alias GroupherServerWeb.Schema

  @query "query($communityRef: String!) { currentCommunityAdmin(communityRef: $communityRef) { isLord permissions } }"

  test "reads only the viewer's facts for the requested visible community" do
    {:ok, owner} = db_insert(:user)
    {:ok, viewer} = db_insert(:user)
    {:ok, other} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    Repo.insert!(
      CommunityAdmin.changeset(%CommunityAdmin{}, %{
        community_id: community.id,
        user_id: viewer.id,
        is_lord: true
      })
    )

    vars = %{"communityRef" => community.ref}

    assert {:ok, %{data: %{"currentCommunityAdmin" => %{"isLord" => true}}}} =
             Absinthe.run(@query, Schema, variables: vars, context: %{cur_user: viewer})

    assert {:ok, %{data: %{"currentCommunityAdmin" => nil}}} =
             Absinthe.run(@query, Schema, variables: vars, context: %{cur_user: other})

    assert {:ok, %{errors: [_ | _]}} = Absinthe.run(@query, Schema, variables: vars)

    assert {:ok, %{errors: [_ | _]}} =
             Absinthe.run(@query, Schema,
               variables: %{"communityRef" => "cm_nonexistent"},
               context: %{cur_user: viewer}
             )
  end

  test "does not disclose a suspended community to an unrelated viewer" do
    {:ok, owner} = db_insert(:user)
    {:ok, outsider} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    lifecycle =
      Repo.get_by!(GroupherServer.CMS.Model.CommunityLifecycle, community_id: community.id)

    lifecycle |> Ecto.Changeset.change(state: :suspended) |> Repo.update!()
    vars = %{"communityRef" => community.ref}

    assert {:ok, %{errors: [_ | _]}} =
             Absinthe.run(@query, Schema, variables: vars, context: %{cur_user: outsider})

    assert {:ok, %{data: %{"currentCommunityAdmin" => %{"isLord" => _}}}} =
             Absinthe.run(@query, Schema, variables: vars, context: %{cur_user: owner})
  end
end
