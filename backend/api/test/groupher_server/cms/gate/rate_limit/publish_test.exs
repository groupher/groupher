defmodule GroupherServer.Test.CMS.Gate.RateLimit.Publish do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Model.GlobalPassport
  alias CMS.Gate.RateLimit.Publish.Model.PublishThrottle

  @throttle_interval CMS.Gate.RateLimit.Publish.Config.publish_throttle().interval_minutes

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)

    {:ok, ~m(user_conn guest_conn community user)a}
  end

  test "user first create content should add fresh throttle record.", ~m(community user)a do
    post_attrs = mock_attrs(:post, %{community_id: community.id})

    {:ok, _} =
      GroupherServer.Support.Factory.create_published_article(community, :post, post_attrs, user)

    {:ok, pt_record} = PublishThrottle |> ORM.find_by(user_id: user.id)

    assert pt_record.date_count == 1
    assert pt_record.hour_count == 1
  end

  test "user create 2 content should update throttle record.", ~m(community)a do
    {:ok, user} = db_insert(:user)
    post_attrs = mock_attrs(:post, %{community_id: community.id})
    post_attrs2 = mock_attrs(:post, %{community_id: community.id})

    {:ok, _} =
      GroupherServer.Support.Factory.create_published_article(community, :post, post_attrs, user)

    CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
      :last_publish_time,
      %User{id: user.id},
      minutes: -@throttle_interval
    )

    {:ok, _} =
      GroupherServer.Support.Factory.create_published_article(community, :post, post_attrs2, user)

    {:ok, pt_record} = PublishThrottle |> ORM.find_by(user_id: user.id)

    assert pt_record.date_count == 2
    assert pt_record.hour_count == 2
  end

  test "load_and_reset clears both expired windows before checking limits", ~m(community user)a do
    post_attrs = mock_attrs(:post, %{community_id: community.id})

    {:ok, _} =
      GroupherServer.Support.Factory.create_published_article(community, :post, post_attrs, user)

    CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
      :publish_hour,
      %User{id: user.id},
      hours: -1
    )

    CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
      :publish_date,
      %User{id: user.id},
      days: -2
    )

    assert {:ok, record} =
             CMS.Gate.RateLimit.Publish.load_and_reset(%User{id: user.id})

    assert record.hour_count == 0
    assert record.date_count == 0
  end

  test "only the current Global Passport root fact bypasses publish limits" do
    {:ok, user} = db_insert(:user)
    actor = %{user | cur_passport: %{"global" => %{"god" => true}}}
    assert {:ok, _record} = CMS.Gate.RateLimit.Publish.record(user)

    assert {:error, _reason} = CMS.Gate.RateLimit.Publish.check(actor, hour_limit: 0)

    assert {:ok, {:error, _reason}} =
             Repo.transaction(fn ->
               CMS.Gate.RateLimit.Publish.check_in_transaction(actor, hour_limit: 0)
             end)

    passport =
      %GlobalPassport{}
      |> GlobalPassport.changeset(%{user_id: user.id, is_root: true, permissions: %{}})
      |> Repo.insert!()

    assert {:ok, :publish} = CMS.Gate.RateLimit.Publish.check(actor, hour_limit: 0)

    assert {:ok, {:ok, :publish}} =
             Repo.transaction(fn ->
               CMS.Gate.RateLimit.Publish.check_in_transaction(actor, hour_limit: 0)
             end)

    passport
    |> GlobalPassport.changeset(%{is_root: false})
    |> Repo.update!()

    assert {:error, _reason} = CMS.Gate.RateLimit.Publish.check(actor, hour_limit: 0)

    assert {:ok, {:error, _reason}} =
             Repo.transaction(fn ->
               CMS.Gate.RateLimit.Publish.check_in_transaction(actor, hour_limit: 0)
             end)
  end
end
