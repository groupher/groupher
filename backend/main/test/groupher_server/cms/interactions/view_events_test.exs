defmodule GroupherServer.Test.CMS.Interactions.ViewEventsTest do
  use GroupherServer.TestMate

  alias GroupherServer.CMS.Model.ViewEvent
  alias GroupherServer.CMS.Interactions.State
  alias GroupherServer.CMS.Interactions.ViewEvents
  alias GroupherServer.Repo

  test "view event ids are unique and target types are constrained" do
    event_id = Ecto.UUID.generate()
    now = DateTime.utc_now(:second)

    assert {1, _} =
             Repo.insert_all(ViewEvent, [
               %{
                 event_id: event_id,
                 inserted_at: now,
                 target_id: 1,
                 target_type: :post,
                 updated_at: now
               }
             ])

    assert %ViewEvent{target_type: :post} = Repo.get!(ViewEvent, event_id)

    assert {0, _} =
             Repo.insert_all(
               ViewEvent,
               [
                 %{
                   event_id: event_id,
                   inserted_at: now,
                   target_id: 1,
                   target_type: :post,
                   updated_at: now
                 }
               ],
               on_conflict: :nothing,
               conflict_target: :event_id
             )

    refute ViewEvent.changeset(%ViewEvent{}, %{
             event_id: event_id,
             target_id: 1,
             target_type: :other
           }).valid?
  end

  test "retention deletes only old processed events" do
    old = DateTime.add(DateTime.utc_now(:second), -31, :day)
    processed_id = Ecto.UUID.generate()
    pending_id = Ecto.UUID.generate()

    assert {2, _} =
             Repo.insert_all(ViewEvent, [
               %{
                 event_id: processed_id,
                 inserted_at: old,
                 processed_at: old,
                 target_id: 1,
                 target_type: :post,
                 updated_at: old
               },
               %{
                 event_id: pending_id,
                 inserted_at: old,
                 target_id: 1,
                 target_type: :post,
                 updated_at: old
               }
             ])

    assert {1, nil} = ViewEvents.delete_expired()
    assert is_nil(Repo.get(ViewEvent, processed_id))
    assert %ViewEvent{} = Repo.get(ViewEvent, pending_id)
  end

  test "view metrics count pending and failed events" do
    now = DateTime.utc_now(:second)

    assert {2, _} =
             Repo.insert_all(ViewEvent, [
               %{
                 event_id: Ecto.UUID.generate(),
                 inserted_at: now,
                 target_id: 1,
                 target_type: :post,
                 updated_at: now
               },
               %{
                 event_id: Ecto.UUID.generate(),
                 failed_at: now,
                 inserted_at: now,
                 target_id: 2,
                 target_type: :post,
                 updated_at: now
               }
             ])

    assert %{
             pending_view_events_count: 2,
             failed_view_events_count: 1,
             view_worker_lag_seconds: lag
           } = ViewEvents.metrics()

    assert is_integer(lag)
  end

  test "a recorded view is projected once into the counter and viewer state" do
    {_community, post, _attrs, user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, ^event_id} = ViewEvents.record(post, user, event_id)
    assert :ok = ViewEvents.project(event_id)
    assert :ok = ViewEvents.project(event_id)

    assert Repo.get!(post.__struct__, post.id).views == 1

    [hydrated] = State.read(:post, [post], user, [])
    assert hydrated.viewer_has_viewed
  end
end
