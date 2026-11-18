defmodule GroupherServer.Test.CMS.Passport.LegacyConversionTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Model.{CommunityAdmin, GlobalPassport}
  alias GroupherServer.CMS.Passport.LegacyConversion

  test "converts verified facts once and refuses replay after revocation" do
    {:ok, user} = db_insert(:user)
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    member =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          user_id: user.id,
          community_id: community.id
        })
      )

    legacy = GroupherServer.CMS.Model.Passport

    Repo.insert!(
      legacy.changeset(struct(legacy), %{
        user_id: user.id,
        rules: %{
          "global" => %{"god" => true, "community.create" => true},
          community.slug => %{"root" => true, "cms" => %{}}
        }
      })
    )

    assert {:ok, :pass} = LegacyConversion.apply(user.id)
    global = Repo.get_by!(GlobalPassport, user_id: user.id)
    member = Repo.get!(CommunityAdmin, member.id)
    assert global.is_root and global.permissions == %{"community.create" => true}
    assert member.is_lord and member.revision == 2
    member |> CommunityAdmin.changeset(%{is_lord: false, revision: 3}) |> Repo.update!()

    global
    |> GlobalPassport.changeset(%{is_root: false, permissions: %{}, revision: 2})
    |> Repo.update!()

    assert {:error, :legacy_already_converted} = LegacyConversion.apply(user.id)
    refute Repo.get!(CommunityAdmin, member.id).is_lord
    refute Repo.get!(GlobalPassport, global.id).is_root
  end

  test "later membership failure rolls back the Global change and conversion marker" do
    {:ok, user} = db_insert(:user)
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    member =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          user_id: user.id,
          community_id: community.id,
          permissions: %{"article.update" => true}
        })
      )

    legacy = GroupherServer.CMS.Model.Passport

    Repo.insert!(
      legacy.changeset(struct(legacy), %{
        user_id: user.id,
        rules: %{
          "global" => %{"god" => true},
          community.slug => %{"root" => true, "cms" => %{}}
        }
      })
    )

    assert {:error, :permission_scope_mismatch} = LegacyConversion.apply(user.id)
    assert is_nil(Repo.get_by(GlobalPassport, user_id: user.id))
    refute Repo.get!(CommunityAdmin, member.id).is_lord

    assert %{rows: [[0]]} =
             Repo.query!("SELECT count(*) FROM cms.passport_conversion_runs WHERE user_id = $1", [
               user.id
             ])
  end

  test "closed migration window rejects conversion" do
    {:ok, user} = db_insert(:user)
    assert {:ok, :pass} = LegacyConversion.close_window()
    assert {:error, :legacy_conversion_closed} = LegacyConversion.apply(user.id)
  end

  test "unresolved legacy thread grants block all writes" do
    {:ok, user} = db_insert(:user)
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    member =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          user_id: user.id,
          community_id: community.id
        })
      )

    legacy = GroupherServer.CMS.Model.Passport

    Repo.insert!(
      legacy.changeset(struct(legacy), %{
        user_id: user.id,
        rules: %{
          "global" => %{"god" => true},
          community.slug => %{"root" => true, "cms" => %{"post.community_tag.set" => true}}
        }
      })
    )

    assert {:error, {:legacy_conversion_unresolved, [_ | _]}} = LegacyConversion.apply(user.id)
    assert is_nil(Repo.get_by(GlobalPassport, user_id: user.id))
    refute Repo.get!(CommunityAdmin, member.id).is_lord
  end
end
