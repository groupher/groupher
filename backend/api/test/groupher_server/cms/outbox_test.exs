defmodule GroupherServer.Test.CMS.OutboxTest do
  @moduledoc false

  use GroupherServer.TestMate

  import Ecto.Query

  alias GroupherServer.{CMS, ErrorCat, Repo}
  alias CMS.Outbox.{Event, WorkerRegistry}

  test "stores a typed event and its wakeup inside the caller transaction" do
    attrs = event_attrs(Ecto.UUID.generate())
    assert {:ok, event} = send_event(attrs)
    assert event.operation_ref == attrs.operation_ref
    assert event.dedupe_key == attrs.dedupe_key
    assert event.worker == inspect(attrs.worker)
    assert event.status == :waiting

    assert Repo.aggregate(
             from(row in Event, where: row.id == ^event.id),
             :count,
             :id
           ) == 1
  end

  test "reuses an identical effect across operations without changing first provenance" do
    first = event_attrs(Ecto.UUID.generate())
    second = %{first | operation_ref: Ecto.UUID.generate()}

    assert {:ok, stored} = send_event(first)
    assert {:ok, repeated} = send_event(second)
    assert repeated.id == stored.id
    assert repeated.operation_ref == first.operation_ref
  end

  test "keeps the persisted route stable and rejects unknown worker modules" do
    attrs = event_attrs(Ecto.UUID.generate())
    assert {:ok, stored} = send_event(attrs)

    assert {:error, {:outbox_worker_conflict, event_id}} =
             send_event(%{attrs | worker: GroupherServer.Jobs.CMSOutboxComment})

    assert event_id == stored.id

    assert {:error, :outbox_worker_invalid} =
             send_event(%{attrs | worker: Map})

    assert {:ok, worker_name} = WorkerRegistry.name_for(GroupherServer.Jobs.CMSOutboxArticle)
    assert worker_name == inspect(GroupherServer.Jobs.CMSOutboxArticle)

    assert :error = WorkerRegistry.worker_for("GroupherServer.Jobs.UnknownOutboxWorker")
  end

  test "rejects a conflicting payload under the same effect key" do
    attrs = event_attrs(Ecto.UUID.generate())
    assert {:ok, _} = send_event(attrs)

    assert {:error, {:outbox_payload_conflict, _}} =
             send_event(put_in(attrs.data.snapshot_id, Ecto.UUID.generate()))
  end

  test "rejects unsupported events, missing operation identity, and missing workers" do
    attrs = event_attrs(Ecto.UUID.generate())

    assert {:error, {:outbox_event_owner_missing, "test.unsupported"}} =
             send_event(%{attrs | event: "test.unsupported"})

    assert {:error, :outbox_operation_ref_required} =
             send_event(Map.delete(attrs, :operation_ref))

    assert {:error, :outbox_worker_required} = send_event(Map.delete(attrs, :worker))
  end

  test "accepts the payload contract required by the comment created worker" do
    attrs = %{
      event: "comment.created",
      worker: GroupherServer.Jobs.CMSOutboxComment,
      resource_type: "comment",
      resource_id: 42,
      operation_ref: Ecto.UUID.generate(),
      dedupe_key: "comment.created:42",
      data: %{article_id: Ecto.UUID.generate(), actor_id: 7, community_id: 9}
    }

    assert {:ok, event} = send_event(attrs)
    assert event.event == "comment.created"

    assert event.data == %{
             "article_id" => attrs.data.article_id,
             "actor_id" => 7,
             "community_id" => 9
           }
  end

  test "event insertion rolls back with the enclosing transaction" do
    attrs = event_attrs(Ecto.UUID.generate())

    assert {:error, :rolled_back} =
             Repo.transaction(fn ->
               assert {:ok, event} = CMS.Outbox.send(attrs)
               Repo.rollback(:rolled_back)
               event
             end)

    refute Repo.exists?(from(event in Event, where: event.dedupe_key == ^attrs.dedupe_key))
  end

  test "a failed event can be claimed, retried, and completed" do
    {:ok, event} = send_event(event_attrs(Ecto.UUID.generate()))

    assert {:error, :temporary_failure} =
             CMS.Outbox.execute(event.id, fn _ -> {:error, :temporary_failure} end)

    assert Repo.get!(Event, event.id).status == :retrying
    assert {:ok, :recovered} = CMS.Outbox.execute(event.id, fn _ -> {:ok, :recovered} end)
    assert Repo.get!(Event, event.id).status == :done
  end

  test "a terminal failure increments its failure generation and fences later delivery" do
    {:ok, event} = send_event(event_attrs(Ecto.UUID.generate()))

    assert {:error, %ErrorCat.Error{reason: :outbox_delivery_exhausted}} =
             CMS.Outbox.execute(event.id, fn _ -> {:error, :permanent_failure} end,
               on_error: :fail
             )

    assert %Event{status: :failed, failure_generation: 1} = Repo.get!(Event, event.id)
    assert {:error, :outbox_event_failed} = CMS.Outbox.execute(event.id, fn _ -> {:ok, :nope} end)
  end

  test "an expired lease is reclaimed while a live lease is busy" do
    {:ok, event} = send_event(event_attrs(Ecto.UUID.generate()))

    event
    |> Event.changeset(%{
      status: :running,
      attempts: 1,
      locked_at: DateTime.utc_now(:second),
      locked_by: "live-worker"
    })
    |> Repo.update!()

    assert {:busy, seconds} = CMS.Outbox.execute(event.id, fn _ -> {:ok, :nope} end)
    assert seconds in 1..120

    Event
    |> where([row], row.id == ^event.id)
    |> Repo.update_all(set: [locked_at: DateTime.add(DateTime.utc_now(:second), -121, :second)])

    assert {:ok, :reclaimed} = CMS.Outbox.execute(event.id, fn _ -> {:ok, :reclaimed} end)
    assert Repo.get!(Event, event.id).attempts == 2
  end

  test "payload projections reject unsupported contract versions without mutating the event" do
    attrs = event_attrs(Ecto.UUID.generate())
    {:ok, event} = send_event(attrs)
    assert event.contract_version == 1

    assert {:error, {:outbox_contract_version_conflict, _}} =
             send_event(Map.put(attrs, :contract_version, 2))

    assert Repo.get!(Event, event.id).status == :waiting
  end

  test "unsupported new intents are rejected before an event or wakeup is stored" do
    attrs = event_attrs(Ecto.UUID.generate()) |> Map.put(:contract_version, 2)
    assert {:error, {:outbox_contract_version_conflict, nil}} = send_event(attrs)
    refute Repo.get_by(Event, dedupe_key: attrs.dedupe_key)
  end

  test "delivery refuses an unsupported stored payload version without acquiring a lease" do
    assert {:ok, event} = send_event(event_attrs(Ecto.UUID.generate()))
    stored = Repo.update!(Event.changeset(event, %{contract_version: 2}))

    assert {:error, {:outbox_contract_version_conflict, id}} =
             CMS.Outbox.execute(event.id, fn _ ->
               send(self(), :unsupported_payload_delivered)
               {:ok, :unexpected}
             end)

    assert id == stored.id
    refute_receive :unsupported_payload_delivered
    assert Repo.get!(Event, event.id) == stored
  end

  defp event_attrs(operation_ref) do
    %{
      event: "article.updated",
      worker: GroupherServer.Jobs.CMSOutboxArticle,
      resource_type: "article",
      resource_id: Ecto.UUID.generate(),
      operation_ref: operation_ref,
      dedupe_key: "test-effect-#{operation_ref}",
      data: %{
        community: "test",
        community_id: 1,
        thread: :post,
        inner_id: 1,
        article_id: Ecto.UUID.generate(),
        snapshot_id: Ecto.UUID.generate()
      }
    }
  end

  defp send_event(attrs) do
    case Repo.transaction(fn -> CMS.Outbox.send(attrs) end) do
      {:ok, {:ok, event}} -> {:ok, event}
      {:ok, {:error, reason}} -> {:error, reason}
      {:error, reason} -> {:error, reason}
    end
  end
end
