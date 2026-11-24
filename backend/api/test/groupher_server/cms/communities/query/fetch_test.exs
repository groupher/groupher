defmodule GroupherServer.Test.CMS.Communities.Query do
  @moduledoc false
  use GroupherServer.TestMate
  alias GroupherServer.CMS
  alias GroupherServer.Repo
  alias CMS.Model.CommunityAdmin
  alias CMS.Model.CommunityLifecycle

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, ~m(user community user2 user3)a}
  end

  describe "[cms community fetch]" do
    test "fetch community should inc views", ~m(community)a do
      {:ok, community} = CMS.Communities.fetch(community.slug)
      assert community.views == 1
      {:ok, community} = CMS.Communities.fetch(community.slug)
      assert community.views == 2
      {:ok, community} = CMS.Communities.fetch(community.slug)
      assert community.views == 3
    end

    test "fetch community should not inc views if opt provide", ~m(community)a do
      {:ok, community} = CMS.Communities.fetch(community.slug, inc_views: false)
      assert community.views == 0
      {:ok, community} = CMS.Communities.fetch(community.slug, inc_views: false)
      assert community.views == 0
      {:ok, community} = CMS.Communities.fetch(community.slug, inc_views: false)
      assert community.views == 0
    end

    test "missing public community preserves the community not-exist error" do
      assert {:error,
              %ErrorCat.Error{
                namespace: {:cms, :community},
                reason: :not_exist,
                code: 5504
              }} = CMS.Communities.fetch("missing-community")
    end

    test "denied viewer reads do not inc views", ~m(community user2)a do
      Repo.get_by!(CommunityLifecycle, community_id: community.id)
      |> CommunityLifecycle.changeset(%{state: :suspended})
      |> Repo.update!()

      assert {:error,
              %ErrorCat.Error{
                namespace: {:cms, :community},
                reason: :not_exist,
                details: "Community"
              }} =
               CMS.Communities.fetch(community.slug, user2)

      assert Repo.get!(CMS.Model.Community, community.id).views == 0
    end

    test "read subscribed community should have a flag", ~m(community user user2)a do
      {:ok, _} = CMS.Communities.Subscriptions.Setup.subscribe(community, user)

      {:ok, community} = CMS.Communities.fetch(community.slug, user)

      assert community.viewer_has_subscribed
      assert user.id in community.meta.subscribed_user_ids

      {:ok, community} = CMS.Communities.fetch(community.slug, user2)
      assert not community.viewer_has_subscribed
      assert user2.id not in community.meta.subscribed_user_ids
    end

    test "read Admin membership should have a flag", ~m(community user user2 user3)a do
      Repo.insert!(%CommunityAdmin{community_id: community.id, user_id: user2.id})
      {:ok, community} = CMS.Communities.Count.update(community, user2, :admins_count, :inc)

      {:ok, community} = CMS.Communities.fetch(community.slug, user2)
      assert community.viewer_is_admin

      {:ok, community} = CMS.Communities.fetch(community.slug, user3)
      assert not community.viewer_is_admin

      Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: user2.id)
      |> Repo.delete!()
      {:ok, community} = CMS.Communities.Count.update(community, user2, :admins_count, :dec)

      {:ok, community} = CMS.Communities.fetch(community.slug, user2)

      assert not community.viewer_is_admin
    end

    test "owner policy mode does not widen to Admin access",
         ~m(community user user2)a do
      Repo.insert!(%CommunityAdmin{community_id: community.id, user_id: user2.id})

      assert {:error, %ErrorCat.Error{reason: :not_exist}} =
               CMS.Communities.fetch(community.slug, user2,
                 policy_mode: :owner,
                 inc_views: false
               )

      assert {:ok, _community} =
               CMS.Communities.fetch(community.slug, user2,
                 policy_mode: :admin,
                 inc_views: false
               )
    end
  end
end
