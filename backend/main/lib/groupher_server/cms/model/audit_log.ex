defmodule GroupherServer.CMS.Model.AuditLog do
  @moduledoc """
  Append-only CMS accountability record.

  Resource and actor references are snapshots rather than foreign keys so the
  audit survives permanent deletion of the underlying business data.

  Business position:

      CMS context
        -> AuditLog schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @required_fields ~w(community_id actor_type action resource_type resource_ref source occurred_at)a
  @optional_fields ~w(actor_id actor_snapshot resource_snapshot operation_ref metadata)a

  @type t :: %__MODULE__{}

  schema "audit_logs" do
    field(:hash_id, Ecto.UUID, autogenerate: true)
    field(:community_id, :id)
    field(:actor_type, :string)
    field(:actor_id, :id)
    field(:actor_snapshot, :map, default: %{})
    field(:action, :string)
    field(:resource_type, :string)
    field(:resource_ref, :string)
    field(:resource_snapshot, :map, default: %{})
    field(:operation_ref, Ecto.UUID)
    field(:source, :string)
    field(:metadata, :map, default: %{})
    field(:occurred_at, :utc_datetime)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(log, attrs) do
    log
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:actor_type, ["user", "system"])
    |> validate_length(:action, min: 3, max: 120)
    |> validate_length(:resource_type, min: 1, max: 80)
    |> validate_length(:resource_ref, min: 1, max: 240)
    |> validate_length(:source, min: 1, max: 40)
    |> unique_constraint(:hash_id)
  end
end
