defmodule GroupherServer.Test.CMS.Passport.CommunityAdmissionReviewTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Model.CommunityAdmin

  test "unsupported snapshot resources keep the Gate Decision error protocol" do
    assert {:error, %CMS.Gate.Decision{allowed: false}} =
             CMS.Gate.community_snapshot_check(nil, :read, nil)
  end

  test "a stale Admin identity projection cannot authorize a removed member" do
    {:ok, owner} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    member =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          community_id: community.id,
          user_id: actor.id
        })
      )

    assert {:ok, _} = CMS.Communities.Count.update(community, actor, :admins_count, :inc)
    Repo.delete!(member)

    assert {:error, %CMS.Gate.Decision{allowed: false}} =
             CMS.Gate.access_check(actor, :update, community)
  end

  test "a current Admin membership does not depend on the identity projection" do
    {:ok, owner} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    Repo.insert!(
      CommunityAdmin.changeset(%CommunityAdmin{}, %{community_id: community.id, user_id: actor.id})
    )

    assert {:ok, %CMS.Model.Community{}} = CMS.Gate.access_check(actor, :update, community)
  end

  test "Community ownership or membership cannot substitute a Global category grant" do
    {:ok, owner} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    member =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          community_id: community.id,
          user_id: actor.id
        })
      )

    assert {:ok, _} = CMS.Communities.Count.update(community, actor, :admins_count, :inc)

    for user <- [owner, actor],
        action <- [
          :category_create,
          :category_update,
          :category_delete,
          :category_set,
          :category_unset
        ] do
      Repo.delete_all(
        from(passport in CMS.Model.GlobalPassport, where: passport.user_id == ^user.id)
      )

      assert {:error, %CMS.Gate.Decision{allowed: false}} =
               CMS.Gate.access_check(user, action, community)
    end

    Repo.insert!(
      CMS.Model.GlobalPassport.changeset(%CMS.Model.GlobalPassport{}, %{
        user_id: actor.id,
        permissions: %{"category.create" => true}
      })
    )

    assert {:ok, %CMS.Model.Community{}} =
             CMS.Gate.access_check(actor, :category_create, community)

    assert Repo.get!(CommunityAdmin, member.id).permissions == %{}
  end

  test "Dashboard commands enforce their dedicated Passport actions without middleware" do
    {:ok, owner} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    member =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          community_id: community.id,
          user_id: actor.id
        })
      )

    assert {:ok, _} = CMS.Communities.Count.update(community, actor, :admins_count, :inc)

    for call <- [
          fn ->
            CMS.Dashboard.select_theme_preset(community, %{}, actor, Ecto.UUID.generate())
          end,
          fn ->
            CMS.Dashboard.save_custom_theme_preset(community, %{}, actor, Ecto.UUID.generate())
          end,
          fn -> CMS.Dashboard.update(community, :rss, %{}, actor, Ecto.UUID.generate()) end
        ] do
      assert {:error, %ErrorCat.Error{reason: :permission_denied}} = call.()
    end

    member
    |> CommunityAdmin.changeset(%{
      permissions: %{"dashboard.theme.update" => true, "dashboard.rss.update" => true}
    })
    |> Repo.update!()

    for action <- [:dashboard_theme_update, :dashboard_rss_update] do
      assert {:ok, %CMS.Model.Community{}} = CMS.Gate.access_check(actor, action, community)
    end

    assert {:ok, %CMS.Model.CommunityDashboard{}} =
             CMS.Dashboard.select_theme_preset(
               community,
               %{theme_preset: :default},
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, %CMS.Model.CommunityDashboard{}} =
             CMS.Dashboard.update(community, :rss, %{}, actor, Ecto.UUID.generate())

    {:ok, other_community} = mock_community(owner)

    assert {:error, %CMS.Gate.Decision{allowed: false}} =
             CMS.Gate.access_check(actor, :dashboard_theme_update, other_community)

    Repo.get!(CommunityAdmin, member.id)
    |> CommunityAdmin.changeset(%{permissions: %{}})
    |> Repo.update!()

    assert {:error, %CMS.Gate.Decision{allowed: false}} =
             CMS.Gate.access_check(actor, :dashboard_theme_update, community)
  end
end
