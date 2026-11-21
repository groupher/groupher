defmodule GroupherServer.Test.CMS.Passport.GlobalFactsTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Passport
  alias CMS.Model.{CommunityAdmin, GlobalPassport}

  test "returns normalized facts and fails closed for invalid stored grants" do
    {:ok, user} = db_insert(:user)
    assert {:ok, %{is_root: false, permissions: %{}}} = Passport.global_facts(user.id)

    row =
      Repo.insert!(
        GlobalPassport.changeset(%GlobalPassport{}, %{
          user_id: user.id,
          is_root: true,
          permissions: %{"community.create" => true, "community.request_destroy" => false}
        })
      )

    assert {:ok, %{is_root: true, permissions: %{"community.create" => true}}} =
             Passport.global_facts(user.id)

    row |> GlobalPassport.changeset(%{permissions: %{"article.update" => true}}) |> Repo.update!()
    assert {:error, :permission_scope_mismatch} = Passport.global_facts(user.id)
    assert {:error, :permission_scope_mismatch} = Passport.system_root?(user.id)

    row
    |> GlobalPassport.changeset(%{permissions: %{"unregistered.action" => true}})
    |> Repo.update!()

    assert {:error, :unknown_action} = Passport.global_facts(user.id)

    row
    |> GlobalPassport.changeset(%{permissions: %{"community.create" => "yes"}})
    |> Repo.update!()

    assert {:error, :invalid_permission_value} = Passport.global_facts(user.id)
  end

  test "registered Global authorization uses stored grants and ignores stale cur_passport" do
    {:ok, user} = db_insert(:user)

    legacy_user = %{
      user
      | cur_passport: %{
          "global" => %{
            "review.platform.read" => true,
            "review.platform.decide" => true
          }
        }
    }

    assert {:error, _reason} =
             Passport.Authorization.check(legacy_user, "review.platform.read")

    row =
      Repo.insert!(
        GlobalPassport.changeset(%GlobalPassport{}, %{
          user_id: user.id,
          permissions: %{
            "review.platform.read" => true,
            "review.platform.decide" => true
          }
        })
      )

    assert {:ok, true} = Passport.Authorization.check(legacy_user, "review.platform.read")
    assert {:ok, true} = Passport.Authorization.check(legacy_user, "review.platform.decide")

    Repo.update!(GlobalPassport.changeset(row, %{permissions: %{}}))

    assert {:error, _reason} =
             Passport.Authorization.check(legacy_user, "review.platform.read")

    assert {:error, _reason} =
             Passport.Authorization.check(legacy_user, "review.platform.decide")
  end

  test "registered Community authorization uses stored grants and ignores stale cur_passport" do
    {:ok, community} = mock_community()
    {:ok, user} = db_insert(:user)

    legacy_user = %{
      user
      | cur_passport: %{community.slug => %{"cms" => %{"review.read" => true}}}
    }

    assert {:error, _reason} =
             Passport.Authorization.check(
               legacy_user,
               "review.read",
               %{community: community.slug}
             )

    member =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          user_id: user.id,
          community_id: community.id,
          permissions: %{"review.read" => true}
        })
      )

    assert {:ok, true} =
             Passport.Authorization.check(
               legacy_user,
               "review.read",
               %{community: community.slug}
             )

    Repo.update!(CommunityAdmin.changeset(member, %{permissions: %{}}))

    assert {:error, _reason} =
             Passport.Authorization.check(
               legacy_user,
               "review.read",
               %{community: community}
             )
  end
end
