defmodule GroupherServer.Test.CMS.OutboxTest do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.{CMS, Repo}
  alias CMS.Outbox.Event

  test "an event is completed once and duplicate delivery is a no-op" do
    assert {:ok, event} =
             CMS.Outbox.send(%{
               event: "test.completed",
               worker: CMS.Outbox.Workers.Article.Cleanup,
               resource_type: "test",
               resource_id: "one",
               command_id: Ecto.UUID.generate(),
               data: %{value: 1}
             })

    assert {:ok, :done} =
             CMS.Outbox.execute(event.id, fn received ->
               send(self(), {:outbox_action, received.id, received.attempts})
               {:ok, :done}
             end)

    assert_receive {:outbox_action, id, 1}
    assert id == event.id

    assert {:ok, :completed} =
             CMS.Outbox.execute(event.id, fn _received ->
               send(self(), :must_not_run)
               {:ok, :wrong}
             end)

    refute_receive :must_not_run
    assert Repo.get!(Event, event.id).status == :completed
  end

  test "a failed event can be claimed and retried" do
    assert {:ok, event} =
             CMS.Outbox.send(%{
               event: "test.retry",
               worker: CMS.Outbox.Workers.Article.Cleanup,
               resource_type: "test",
               resource_id: "two",
               command_id: Ecto.UUID.generate()
             })

    assert {:error, :temporary_failure} =
             CMS.Outbox.execute(event.id, fn _received -> {:error, :temporary_failure} end)

    assert Repo.get!(Event, event.id).status == :failed

    assert {:ok, :recovered} =
             CMS.Outbox.execute(event.id, fn _received -> {:ok, :recovered} end)

    assert Repo.get!(Event, event.id).status == :completed
  end

  test "requires an explicit worker and command id" do
    assert {:error, :outbox_worker_required} =
             CMS.Outbox.send(%{
               event: "test.missing_worker",
               resource_type: "test",
               resource_id: "missing",
               command_id: Ecto.UUID.generate()
             })

    assert {:error, :outbox_command_id_required} =
             CMS.Outbox.send(%{
               event: "test.missing_command",
               worker: CMS.Outbox.Workers.Article.Cleanup,
               resource_type: "test",
               resource_id: "missing"
             })
  end

  test "event insertion rolls back with the enclosing transaction" do
    command_id = Ecto.UUID.generate()

    assert {:error, :rolled_back} =
             Repo.transaction(fn ->
               assert {:ok, _event} = CMS.Outbox.send(event_attrs("test.rollback", command_id))
               Repo.rollback(:rolled_back)
             end)

    refute Repo.exists?(from(event in Event, where: event.command_id == ^command_id))
  end

  test "the command-event-resource identity is unique" do
    attrs = event_attrs("test.unique", Ecto.UUID.generate())
    assert {:ok, _event} = CMS.Outbox.send(attrs)
    assert {:error, %Ecto.Changeset{}} = CMS.Outbox.send(attrs)
  end

  test "a live lease makes a second delivery busy" do
    {:ok, event} = CMS.Outbox.send(event_attrs("test.busy", Ecto.UUID.generate()))

    event
    |> Event.changeset(%{
      status: :executing,
      attempts: 1,
      locked_at: DateTime.utc_now(:second),
      locked_by: "live-worker"
    })
    |> Repo.update!()

    assert {:busy, seconds} = CMS.Outbox.execute(event.id, fn _event -> {:ok, :nope} end)
    assert seconds in 1..120
  end

  test "an expired lease is reclaimed" do
    {:ok, event} = CMS.Outbox.send(event_attrs("test.expired_lease", Ecto.UUID.generate()))

    event
    |> Event.changeset(%{
      status: :executing,
      attempts: 1,
      locked_at: DateTime.add(DateTime.utc_now(:second), -121, :second),
      locked_by: "old-worker"
    })
    |> Repo.update!()

    assert {:ok, :reclaimed} =
             CMS.Outbox.execute(event.id, fn _event -> {:ok, :reclaimed} end)

    assert Repo.get!(Event, event.id).attempts == 2
  end

  test "a failed event can be marked dead after retry exhaustion" do
    {:ok, event} = CMS.Outbox.send(event_attrs("test.dead", Ecto.UUID.generate()))

    assert {:error, :permanent_failure} =
             CMS.Outbox.execute(event.id, fn _event -> {:error, :permanent_failure} end)

    assert {:ok, :pass} = CMS.Outbox.mark_dead(event.id)
    assert Repo.get!(Event, event.id).status == :dead
    assert {:error, :outbox_event_dead} = CMS.Outbox.execute(event.id, fn _ -> {:ok, :nope} end)
  end

  defp event_attrs(event, command_id) do
    %{
      event: event,
      worker: CMS.Outbox.Workers.Article.Cleanup,
      resource_type: "test",
      resource_id: event,
      command_id: command_id
    }
  end
end
