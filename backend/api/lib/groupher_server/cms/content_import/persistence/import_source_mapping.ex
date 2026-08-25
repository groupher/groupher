defmodule GroupherServer.CMS.ContentImport.Persistence.ImportSourceMapping do
  @moduledoc """
  Last successful source and Groupher synchronization baseline.

  See `docs/bulk-import/content-import-architecture.md` for mapping ownership and identity.

  Business position:

      Dashboard
        -> Content Import service
        -> CMS.ContentImport
        -> ImportSourceMapping
        -> Repo
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.ContentImport.Persistence.Connection
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @required_fields ~w(
    connection_id thread external_ref thread_ref source_version source_hash groupher_hash
    last_checked_at last_imported_at
  )a
  @optional_fields ~w(source_revision source_updated_at)a

  @type t :: %__MODULE__{}

  schema "content_import_source_mappings" do
    belongs_to(:connection, Connection)

    field(:thread, Ecto.Enum, values: [:doc], default: :doc)
    field(:external_ref, :string)
    field(:thread_ref, Ecto.UUID)
    field(:source_revision, :string)
    field(:source_version, :string)
    field(:source_hash, :string)
    field(:groupher_hash, :string)
    field(:source_updated_at, :utc_datetime)
    field(:last_checked_at, :utc_datetime)
    field(:last_imported_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc "Builds the versioned source/Groupher synchronization baseline changeset."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = mapping, attrs) do
    mapping
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:thread, [:doc])
    |> validate_length(:external_ref, min: 1, max: 1_024)
    |> validate_length(:source_revision, max: 256)
    |> validate_length(:source_version, min: 1, max: 64)
    |> validate_format(:source_hash, ~r/\Asource-md-v1:[0-9a-f]{64}\z/)
    |> validate_format(:groupher_hash, ~r/\Adoc-sync-v1:[0-9a-f]{64}\z/)
    |> foreign_key_constraint(:connection_id)
    |> unique_constraint([:connection_id, :thread, :external_ref],
      name: :content_import_source_mappings_source_index
    )
  end
end
