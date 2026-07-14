defmodule GroupherServer.CMS.ContentImport.Persistence.Snapshot do
  @moduledoc """
  Immutable metadata checkpoint for a fetched platform Snapshot.

  Large Entry bodies and binaries live behind `payload_ref`; the row keeps the
  bounded manifest needed for idempotency and diff planning.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.ContentImport.Persistence.Connection
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(
    connection_id manifest_hash manifest_hash_version entry_hash_version
    normalization_version fetched_at payload_ref entry_count
  )a
  @optional_fields ~w(revision adapter_version checkpoint entry_manifest diagnostics)a

  @type t :: %__MODULE__{}

  schema "content_import_snapshots" do
    belongs_to(:connection, Connection)

    field(:revision, :string)
    field(:manifest_hash, :string)
    field(:manifest_hash_version, :integer)
    field(:entry_hash_version, :integer)
    field(:normalization_version, :integer)
    field(:adapter_version, :string)
    field(:checkpoint, :map, default: %{})
    field(:fetched_at, :utc_datetime)
    field(:payload_ref, :string)
    field(:entry_count, :integer, default: 0)
    field(:entry_manifest, :map, default: %{})
    field(:diagnostics, :map, default: %{"items" => []})

    timestamps(type: :utc_datetime, updated_at: false)
  end

  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = snapshot, attrs) do
    snapshot
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_length(:manifest_hash, is: 64)
    |> validate_number(:manifest_hash_version, greater_than: 0)
    |> validate_number(:entry_hash_version, greater_than: 0)
    |> validate_number(:normalization_version, greater_than: 0)
    |> validate_number(:entry_count, greater_than_or_equal_to: 0)
    |> validate_length(:revision, max: 500)
    |> validate_length(:adapter_version, max: 120)
    |> validate_length(:payload_ref, max: 1_000)
    |> foreign_key_constraint(:connection_id)
    |> unique_constraint([:connection_id, :manifest_hash],
      name: :content_import_snapshots_manifest_index
    )
  end
end
