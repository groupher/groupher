defmodule GroupherServer.CMS.ContentImport.Persistence.Job.Item do
  @moduledoc "Bounded, queryable import-item state and administrator resolution."

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.ContentImport.Persistence.Job
  alias GroupherServer.CMS.ContentImport.Plan
  alias GroupherServer.CMS.ContentImport.Plan.Payload
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @actions ~w(create update skip conflict source_deleted)a
  @resolutions ~w(source_wins local_wins keep unlink archive manual skip)a
  @required_fields ~w(job_id external_ref action selected)a
  @optional_fields ~w(target_ref source_revision source_hash resolution preview)a

  @type action :: :create | :update | :skip | :conflict | :source_deleted
  @type resolution :: :source_wins | :local_wins | :keep | :unlink | :archive | :manual | :skip
  @type t :: %__MODULE__{}

  schema "content_import_job_items" do
    belongs_to(:job, Job)

    field(:external_ref, :string)
    field(:target_ref, :string)
    field(:action, Ecto.Enum, values: @actions)
    field(:resolution, Ecto.Enum, values: @resolutions)
    field(:selected, :boolean, default: true)
    field(:source_revision, :string)
    field(:source_hash, :string)
    field(:preview, :map, default: %{})

    timestamps(type: :utc_datetime)
  end

  @spec actions() :: [action()]
  def actions, do: @actions

  @spec resolutions() :: [resolution()]
  def resolutions, do: @resolutions

  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = item, attrs) do
    item
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:action, @actions)
    |> validate_inclusion(:resolution, @resolutions)
    |> validate_length(:external_ref, min: 1, max: 1_000)
    |> validate_length(:target_ref, max: 500)
    |> validate_length(:source_revision, max: 500)
    |> validate_length(:source_hash, min: 1, max: 160)
    |> validate_resolution()
    |> foreign_key_constraint(:job_id)
    |> unique_constraint([:job_id, :external_ref],
      name: :content_import_job_items_job_source_index
    )
  end

  @spec from_plan_item(pos_integer(), Plan.Item.t()) :: Ecto.Changeset.t()
  def from_plan_item(job_id, %Plan.Item{} = item) do
    changeset(%__MODULE__{}, %{
      job_id: job_id,
      external_ref: item.external_ref,
      target_ref: item.target_ref,
      action: item.action,
      selected: true,
      source_revision: item.source_revision,
      source_hash: item.source_hash,
      preview: bounded_preview(item.payload)
    })
  end

  @spec from_deleted_diff(pos_integer(), map()) :: Ecto.Changeset.t()
  def from_deleted_diff(job_id, diff_item) when is_map(diff_item) do
    changeset(%__MODULE__{}, %{
      job_id: job_id,
      external_ref: value(diff_item, :external_ref),
      target_ref: value(diff_item, :target_ref),
      action: :source_deleted,
      selected: true,
      source_hash: nil,
      preview: %{"localHash" => value(diff_item, :local_hash)}
    })
  end

  @spec resolution_changeset(t(), resolution(), boolean()) :: Ecto.Changeset.t()
  def resolution_changeset(%__MODULE__{} = item, resolution, selected \\ true) do
    changeset(item, %{resolution: resolution, selected: selected})
  end

  defp validate_resolution(changeset) do
    action = get_field(changeset, :action)
    resolution = get_field(changeset, :resolution)

    if is_nil(resolution) or resolution in allowed_resolutions(action) do
      changeset
    else
      add_error(changeset, :resolution, "is not allowed for #{action}")
    end
  end

  defp allowed_resolutions(:conflict),
    do: [:source_wins, :local_wins, :manual, :skip]

  defp allowed_resolutions(:source_deleted), do: [:keep, :unlink, :archive]
  defp allowed_resolutions(action) when action in [:create, :update], do: [:source_wins, :skip]
  defp allowed_resolutions(:skip), do: [:keep]
  defp allowed_resolutions(_action), do: []

  defp bounded_preview(payload), do: Payload.bounded_item_preview(payload)

  defp value(map, key, default \\ nil) do
    Map.get(map, key, Map.get(map, Atom.to_string(key), default))
  end
end
