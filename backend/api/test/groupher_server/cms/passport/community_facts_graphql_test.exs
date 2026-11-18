defmodule GroupherServer.Test.CMS.Passport.CommunityFactsGraphqlTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Model.CommunityAdmin
  alias GroupherServerWeb.Schema

  @query "query($ref: String!) { currentCommunityPassport(communityRef: $ref) { isLord permissions } }"

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

    vars = %{"ref" => community.ref}

    assert {:ok, %{data: %{"currentCommunityPassport" => %{"isLord" => true}}}} =
             Absinthe.run(@query, Schema, variables: vars, context: %{cur_user: viewer})

    assert {:ok,
            %{data: %{"currentCommunityPassport" => %{"isLord" => false, "permissions" => []}}}} =
             Absinthe.run(@query, Schema, variables: vars, context: %{cur_user: other})

    assert {:ok, %{errors: [_ | _]}} = Absinthe.run(@query, Schema, variables: vars)

    assert {:ok, %{errors: [_ | _]}} =
             Absinthe.run(@query, Schema,
               variables: %{"ref" => "cm_nonexistent"},
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
    vars = %{"ref" => community.ref}

    assert {:ok, %{errors: [_ | _]}} =
             Absinthe.run(@query, Schema, variables: vars, context: %{cur_user: outsider})

    assert {:ok, %{data: %{"currentCommunityPassport" => %{"isLord" => _}}}} =
             Absinthe.run(@query, Schema, variables: vars, context: %{cur_user: owner})
  end
end
