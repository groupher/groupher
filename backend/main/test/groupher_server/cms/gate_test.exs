defmodule GroupherServer.Test.CMS.Gate do
  @moduledoc false
  use GroupherServer.TestMate

  alias CMS.Model.CommunityLifecycle

  test "root facade exposes Allow rules" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    assert {:ok, :post} = CMS.Gate.allow_thread(community, :post)
    assert {:ok, :post_comment} = CMS.Gate.allow_emotion(community.slug, :comment, :post, :beer)
  end

  test "passport check accepts a normalized global reviewer passport" do
    reviewer = %{cur_passport: %{"global" => %{"community.application.review" => true}}}

    assert {:ok, true} =
             CMS.Gate.check_passport(reviewer, "community.application.review", %{})
  end

  test "passport check returns a stable denial" do
    reviewer = %{cur_passport: %{"global" => %{}}}

    assert {:error, :permission_denied} =
             CMS.Gate.check_passport(reviewer, "community.application.review", %{})
  end

  test "community access rejects unregistered actions" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    assert {:error, :unknown_action} = CMS.Gate.can(user, :purge, community)
    assert {:error, :unknown_action} = CMS.Gate.check(user, :purge, community)
  end

  test "community command actions use the manage relation preflight" do
    {:ok, owner} = db_insert(:user)
    {:ok, other_user} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    lifecycle =
      Repo.get_by!(CommunityLifecycle, community_id: community.id)
      |> CommunityLifecycle.changeset(%{state: :archived})
      |> Repo.update!()

    community = %{community | lifecycle: lifecycle}

    assert {:ok, true} = CMS.Gate.can(owner, :restore, community)
    assert {:ok, true} = CMS.Gate.can(owner, :schedule_reclaim, community)
    assert {:ok, false} = CMS.Gate.can(other_user, :destroy, community)
    assert {:error, :permission_denied} = CMS.Gate.check(other_user, :archive, community)
  end

  test "community access keeps state capability separate from concrete Gate actions" do
    {:ok, owner} = db_insert(:user)
    {:ok, other_user} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    lifecycle =
      Repo.get_by!(CommunityLifecycle, community_id: community.id)
      |> CommunityLifecycle.changeset(%{state: :read_only})
      |> Repo.update!()

    community = %{community | lifecycle: lifecycle}

    assert {:ok, true} = CMS.Gate.can(nil, :read, community)
    assert {:ok, true} = CMS.Gate.can(owner, :read, community)
    assert {:error, :unknown_action} = CMS.Gate.can(other_user, :write, community)
    assert {:error, :unknown_action} = CMS.Gate.can(owner, :manage, community)
  end

  test "viewer-aware community read hides suspended communities from non-owners" do
    import Ecto.Query

    {:ok, owner} = db_insert(:user)
    {:ok, other_user} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    Repo.get_by!(CommunityLifecycle, community_id: community.id)
    |> CommunityLifecycle.changeset(%{state: :suspended})
    |> Repo.update!()

    assert Repo.exists?(
             from(candidate in CMS.Model.Community, where: candidate.id == ^community.id)
           )

    assert {:ok, _} = CMS.Communities.Read.read(community.slug, owner, inc_views: false)

    assert {:error, {:not_exist, "Community"}} =
             CMS.Communities.Read.read(community.slug, other_user, inc_views: false)
  end
end
