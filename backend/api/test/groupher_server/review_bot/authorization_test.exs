defmodule GroupherServer.Test.ReviewBot.AuthorizationTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Repo, ReviewBot}
  alias CMS.Model.CommunityAdmin

  test "community ReviewBot actions use stored Community Passport facts" do
    {:ok, community} = mock_community()
    {:ok, reviewer} = db_insert(:user)

    Repo.insert!(
      CommunityAdmin.changeset(%CommunityAdmin{}, %{
        user_id: reviewer.id,
        community_id: community.id,
        permissions: %{"review.read" => true}
      })
    )

    scope = %{type: :community, community: community}

    assert {:ok, :pass} = ReviewBot.Authorization.authorize(scope, :read, reviewer)
    assert {:error, _reason} = ReviewBot.Authorization.authorize(scope, :configure, reviewer)

    {:ok, legacy_reviewer} = db_insert(:user)

    legacy_reviewer = %{
      legacy_reviewer
      | cur_passport: %{community.slug => %{"cms" => %{"review.configure" => true}}}
    }

    assert {:error, _reason} =
             ReviewBot.Authorization.authorize(scope, :configure, legacy_reviewer)
  end
end
