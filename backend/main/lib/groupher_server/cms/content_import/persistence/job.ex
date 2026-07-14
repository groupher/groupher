defmodule GroupherServer.CMS.ContentImport.Persistence.Job do
  @moduledoc "Persisted import orchestration state and bounded preview summary."

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.ContentImport.Persistence.{Connection, Snapshot}
  alias GroupherServer.CMS.ContentImport.Status
  alias GroupherServer.CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @threads ~w(doc changelog post)a
  @required_fields ~w(community_id connection_id thread status idempotency_key)a
  @optional_fields ~w(
    snapshot_id actor_id scope_ref preparation_ref preparation_hash preparation_version
    plan_ref plan_hash plan_version plan_summary diff_summary diagnostics progress
    error_code error_message cancelled_at completed_at
  )a

  @transitions %{
    pending: [:loading, :cancelled, :failed],
    loading: [:planning, :cancelled, :failed],
    planning: [:staging, :ready, :cancelled, :failed],
    staging: [:ready, :cancelled, :failed],
    ready: [:staging, :applying, :cancelled],
    applying: [:completed, :failed],
    failed: [:loading, :planning, :staging, :cancelled],
    cancelled: [],
    completed: []
  }

  @type t :: %__MODULE__{}

  schema "content_import_jobs" do
    field(:hash_id, Ecto.UUID, autogenerate: true)
    belongs_to(:community, Community)
    belongs_to(:connection, Connection)
    belongs_to(:snapshot, Snapshot)
    belongs_to(:actor, User)

    field(:thread, Ecto.Enum, values: @threads)
    field(:scope_ref, :string)
    field(:status, Ecto.Enum, values: Status.job(), default: :pending)
    field(:idempotency_key, :string)
    field(:preparation_ref, :string)
    field(:preparation_hash, :string)
    field(:preparation_version, :integer)
    field(:plan_ref, :string)
    field(:plan_hash, :string)
    field(:plan_version, :integer)
    field(:plan_summary, :map, default: %{})
    field(:diff_summary, :map, default: %{})
    field(:diagnostics, :map, default: %{"items" => []})
    field(:progress, :map, default: %{})
    field(:error_code, :string)
    field(:error_message, :string)
    field(:cancelled_at, :utc_datetime)
    field(:completed_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @spec threads() :: [atom()]
  def threads, do: @threads

  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = job, attrs) do
    job
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:thread, @threads)
    |> validate_inclusion(:status, Status.job())
    |> validate_length(:scope_ref, max: 500)
    |> validate_length(:idempotency_key, min: 1, max: 200)
    |> validate_length(:preparation_ref, max: 1_000)
    |> validate_length(:preparation_hash, is: 64)
    |> validate_number(:preparation_version, greater_than: 0)
    |> validate_length(:plan_ref, max: 1_000)
    |> validate_length(:plan_hash, is: 64)
    |> validate_number(:plan_version, greater_than: 0)
    |> validate_length(:error_code, max: 120)
    |> validate_length(:error_message, max: 2_000)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:connection_id)
    |> foreign_key_constraint(:snapshot_id)
    |> foreign_key_constraint(:actor_id)
    |> unique_constraint([:connection_id, :idempotency_key],
      name: :content_import_jobs_idempotency_index
    )
    |> unique_constraint(:hash_id)
  end

  @spec transition_changeset(t(), atom(), DateTime.t()) :: Ecto.Changeset.t()
  def transition_changeset(%__MODULE__{} = job, next_status, now \\ DateTime.utc_now()) do
    allowed = Map.get(@transitions, job.status, [])

    if next_status in allowed do
      attrs =
        %{status: next_status}
        |> maybe_put(:cancelled_at, next_status == :cancelled, now)
        |> maybe_put(:completed_at, next_status == :completed, now)

      changeset(job, attrs)
    else
      job
      |> change()
      |> add_error(:status, "cannot transition from #{job.status} to #{next_status}")
    end
  end

  defp maybe_put(attrs, key, true, value), do: Map.put(attrs, key, value)
  defp maybe_put(attrs, _key, false, _value), do: attrs
end
