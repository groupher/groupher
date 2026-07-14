defmodule GroupherServer.CMS.ContentImport.Persistence.Mapping do
  @moduledoc "Persisted source-to-thread identity and the last successful apply checkpoint."

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.ContentImport.Persistence.Connection
  alias GroupherServer.CMS.ContentImport.Persistence.Snapshot
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @threads ~w(doc changelog post)a
  @required_fields ~w(
    connection_id external_ref thread target_ref last_imported_source_hash
    last_imported_local_hash last_imported_at
  )a
  @optional_fields ~w(snapshot_id last_imported_revision)a

  @type t :: %__MODULE__{}

  schema "content_import_mappings" do
    belongs_to(:connection, Connection)
    belongs_to(:snapshot, Snapshot)

    field(:external_ref, :string)
    field(:thread, Ecto.Enum, values: @threads)
    field(:target_ref, :string)
    field(:last_imported_revision, :string)
    field(:last_imported_source_hash, :string)
    field(:last_imported_local_hash, :string)
    field(:last_imported_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = mapping, attrs) do
    mapping
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:thread, @threads)
    |> validate_length(:external_ref, min: 1, max: 1_000)
    |> validate_length(:target_ref, min: 1, max: 500)
    |> validate_length(:last_imported_revision, max: 500)
    |> validate_length(:last_imported_source_hash, min: 1, max: 160)
    |> validate_length(:last_imported_local_hash, min: 1, max: 160)
    |> foreign_key_constraint(:connection_id)
    |> foreign_key_constraint(:snapshot_id)
    |> unique_constraint([:connection_id, :thread, :external_ref],
      name: :content_import_mappings_source_index
    )
  end
end
