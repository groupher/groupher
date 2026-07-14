defmodule GroupherServer.CMS.ContentImport.Persistence.Job.Asset do
  @moduledoc "Recoverable staging state for one deduplicated Plan.Asset."

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.ContentImport.Persistence.Job
  alias GroupherServer.CMS.ContentImport.Plan
  alias GroupherServer.CMS.ContentImport.Status
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(job_id asset_key source status)a
  @optional_fields ~w(
    source_path mime_type content_hash staging_ref references attempts last_error
    claimed_at lease_expires_at staged_at
  )a

  @transitions %{
    pending: [:staging, :cancelled],
    staging: [:ready, :failed, :cancelled],
    failed: [:staging, :cancelled],
    ready: [],
    cancelled: []
  }

  @type t :: %__MODULE__{}

  schema "content_import_job_assets" do
    belongs_to(:job, Job)

    field(:asset_key, :string)
    field(:source, :map)
    field(:source_path, :string)
    field(:mime_type, :string)
    field(:content_hash, :string)
    field(:staging_ref, :string)
    field(:references, :map, source: :source_references, default: %{"items" => []})
    field(:status, Ecto.Enum, values: Status.job_asset(), default: :pending)
    field(:attempts, :integer, default: 0)
    field(:last_error, :map, default: %{})
    field(:claimed_at, :utc_datetime)
    field(:lease_expires_at, :utc_datetime)
    field(:staged_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = asset, attrs) do
    asset
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:status, Status.job_asset())
    |> validate_length(:asset_key, min: 1, max: 120)
    |> validate_length(:source_path, max: 1_000)
    |> validate_length(:mime_type, max: 120)
    |> validate_length(:content_hash, max: 160)
    |> validate_length(:staging_ref, max: 1_000)
    |> validate_number(:attempts, greater_than_or_equal_to: 0)
    |> validate_ready_fields()
    |> foreign_key_constraint(:job_id)
    |> unique_constraint([:job_id, :asset_key],
      name: :content_import_job_assets_job_asset_index
    )
  end

  @spec from_plan_asset(pos_integer(), Plan.Asset.t()) :: Ecto.Changeset.t()
  def from_plan_asset(job_id, %Plan.Asset{} = asset) do
    changeset(%__MODULE__{}, %{
      job_id: job_id,
      asset_key: asset.asset_key,
      source: encode_source(asset.source),
      source_path: asset.source_path,
      mime_type: asset.mime_type,
      content_hash: asset.content_hash,
      staging_ref: asset.staging_ref,
      references: %{"items" => asset.references},
      status: asset.status
    })
  end

  @spec transition_changeset(t(), atom(), map()) :: Ecto.Changeset.t()
  def transition_changeset(%__MODULE__{} = asset, next_status, attrs \\ %{}) do
    allowed = Map.get(@transitions, asset.status, [])

    if next_status in allowed do
      changeset(asset, Map.put(attrs, :status, next_status))
    else
      asset
      |> change()
      |> add_error(:status, "cannot transition from #{asset.status} to #{next_status}")
    end
  end

  defp validate_ready_fields(changeset) do
    if get_field(changeset, :status) == :ready do
      validate_required(changeset, [:content_hash, :staging_ref, :staged_at])
    else
      changeset
    end
  end

  defp encode_source({:entry, external_ref}),
    do: %{"type" => "entry", "externalRef" => external_ref}

  defp encode_source({:remote_url, url}), do: %{"type" => "remote_url", "url" => url}
end
