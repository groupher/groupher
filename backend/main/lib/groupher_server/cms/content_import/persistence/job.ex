defmodule GroupherServer.CMS.ContentImport.Persistence.Job do
  @moduledoc """
  Persisted execution state for one confirmed Docs import preview.

  See `docs/bulk-import/article-publish-import-refactor.md` for the Job state machine.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.ContentImport.Persistence.Connection
  alias GroupherServer.CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @statuses ~w(staging ready applying completed failed cancelled)a
  @required_fields ~w(
    community_id connection_id thread status preview_ref dataset_ref source_info
    target_revision target_tree
  )a
  @optional_fields ~w(
    actor_id bad_smells counts progress result error_code error_message completed_at
  )a

  @type t :: %__MODULE__{}

  schema "content_import_jobs" do
    field(:hash_id, Ecto.UUID, autogenerate: true)
    belongs_to(:community, Community)
    belongs_to(:connection, Connection)
    belongs_to(:actor, User)

    field(:thread, Ecto.Enum, values: [:doc], default: :doc)
    field(:status, Ecto.Enum, values: @statuses, default: :staging)
    field(:preview_ref, :string)
    field(:dataset_ref, :string)
    field(:source_info, :map)
    field(:target_revision, :string)
    field(:target_tree, :map)
    field(:bad_smells, {:array, :map}, default: [])
    field(:counts, :map, default: %{})
    field(:progress, :map, default: %{})
    field(:result, :map, default: %{})
    field(:error_code, :string)
    field(:error_message, :string)
    field(:completed_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc "Returns the persisted ImportJob lifecycle states."
  @spec statuses() :: [atom()]
  def statuses, do: @statuses

  @doc "Builds the confirmed Preview execution-state changeset."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = job, attrs) do
    job
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:thread, [:doc])
    |> validate_inclusion(:status, @statuses)
    |> validate_length(:preview_ref, min: 1, max: 128)
    |> validate_length(:dataset_ref, min: 1, max: 128)
    |> validate_length(:target_revision, min: 1, max: 512)
    |> validate_length(:error_code, max: 120)
    |> validate_length(:error_message, max: 2_000)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:connection_id)
    |> foreign_key_constraint(:actor_id)
    |> unique_constraint([:community_id, :preview_ref],
      name: :content_import_jobs_preview_index
    )
    |> unique_constraint(:hash_id)
  end
end
