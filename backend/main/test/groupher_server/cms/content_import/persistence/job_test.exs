defmodule GroupherServer.CMS.ContentImport.Persistence.JobTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Persistence.Job

  test "validates the job status vocabulary and idempotency key" do
    changeset =
      Job.changeset(%Job{}, %{
        community_id: 1,
        connection_id: 2,
        thread: :doc,
        status: :pending,
        idempotency_key: "manual:head-sha"
      })

    assert changeset.valid?
    assert Job.__schema__(:type, :cancelled_at) == :utc_datetime
  end

  test "allows only explicit lifecycle transitions" do
    job = %Job{
      community_id: 1,
      connection_id: 2,
      thread: :doc,
      status: :planning,
      idempotency_key: "job:1"
    }

    assert Job.transition_changeset(job, :staging).valid?
    refute Job.transition_changeset(job, :completed).valid?
    assert Job.transition_changeset(%{job | status: :ready}, :staging).valid?

    cancelled = Job.transition_changeset(job, :cancelled, ~U[2026-07-14 01:00:00Z])
    assert Ecto.Changeset.get_change(cancelled, :cancelled_at) == ~U[2026-07-14 01:00:00Z]
  end
end
