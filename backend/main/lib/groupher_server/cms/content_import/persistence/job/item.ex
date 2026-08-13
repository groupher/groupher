defmodule GroupherServer.CMS.ContentImport.Persistence.Job.Item do
  @moduledoc """
  One selected source document and its bounded staging status.

  See `docs/bulk-import/article-publish-import-refactor.md` for terminal item outcomes.

  Business position:

      Dashboard
        -> Content Import service
        -> CMS.ContentImport
        -> Item
        -> Repo
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.ContentImport.Persistence.Job
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @content_statuses ~w(pending ready skipped failed)a
  @required_fields ~w(
    job_id external_ref target_ref title slug route source_revision source_version
    source_hash selected content_status
  )a
  @optional_fields ~w(
    source_updated_at skip_code error_code error_message error_stage body_hash metadata
  )a

  @type t :: %__MODULE__{}

  schema "content_import_job_items" do
    belongs_to(:job, Job)

    field(:external_ref, :string)
    field(:target_ref, Ecto.UUID)
    field(:title, :string)
    field(:slug, :string)
    field(:route, :string)
    field(:source_revision, :string)
    field(:source_version, :string)
    field(:source_hash, :string)
    field(:source_updated_at, :utc_datetime)
    field(:selected, :boolean, default: true)
    field(:content_status, Ecto.Enum, values: @content_statuses, default: :pending)
    field(:skip_code, :string)
    field(:error_code, :string)
    field(:error_message, :string)
    field(:error_stage, :string)
    field(:body_hash, :string)
    field(:metadata, :map, default: %{})

    timestamps(type: :utc_datetime)
  end

  @doc "Builds one selected source document and bounded staging-outcome changeset."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = item, attrs) do
    item
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:content_status, @content_statuses)
    |> validate_length(:external_ref, min: 1, max: 1_024)
    |> validate_length(:title, min: 1, max: 512)
    |> validate_length(:slug, min: 1, max: 512)
    |> validate_length(:route, min: 1, max: 1_024)
    |> validate_length(:source_revision, min: 1, max: 256)
    |> validate_length(:source_version, min: 1, max: 64)
    |> validate_format(:source_hash, ~r/\Asource-md-v1:[0-9a-f]{64}\z/)
    |> validate_format(:body_hash, ~r/\A[0-9a-f]{64}\z/)
    |> validate_inclusion(:skip_code, ["content_too_large"])
    |> validate_length(:error_code, min: 1, max: 120)
    |> validate_length(:error_message, min: 1, max: 2_000)
    |> validate_inclusion(:error_stage, ["source", "conversion", "validation"])
    |> foreign_key_constraint(:job_id)
    |> unique_constraint([:job_id, :external_ref],
      name: :content_import_job_items_job_source_index
    )
  end
end
