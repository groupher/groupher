defmodule GroupherServer.AlertWall.Model.Item do
  @moduledoc """
  One current, scoped risk item assembled from AI opinion and/or user reports.

      trusted owner input -> AlertWall item -> reports and wall actions
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.alert_wall()
  @owners [:cms, :accounts]
  @target_types [:article, :comment, :doc, :user]
  @statuses [:open, :resolved, :superseded]
  @primary_key {:id, :id, autogenerate: true}

  @type t :: %__MODULE__{}

  schema "items" do
    field(:owner, Ecto.Enum, values: @owners)
    field(:target_type, Ecto.Enum, values: @target_types)
    field(:target_id, :string)
    belongs_to(:community, Community)
    field(:subject_ref, :string)
    field(:status, Ecto.Enum, values: @statuses, default: :open)
    field(:ai_source_ref, Ecto.UUID)
    field(:sus_notes, {:array, :map}, default: [])
    field(:summary, :string, default: "")
    field(:version, :integer, default: 1)
    field(:opened_at, :utc_datetime)
    field(:resolved_at, :utc_datetime)
    field(:resolution, :string)
    field(:target_deleted_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  @doc "Validates one trusted owner, target, scope and complete AI opinion."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :owner,
      :target_type,
      :target_id,
      :community_id,
      :subject_ref,
      :status,
      :ai_source_ref,
      :sus_notes,
      :summary,
      :version,
      :opened_at,
      :resolved_at,
      :resolution,
      :target_deleted_at
    ])
    |> validate_required([
      :owner,
      :target_type,
      :target_id,
      :subject_ref,
      :status,
      :version,
      :opened_at
    ])
    |> validate_number(:version, greater_than: 0)
    |> validate_length(:summary, max: 2_000)
    |> validate_sus_notes()
    |> validate_owner_target()
    |> foreign_key_constraint(:community_id)
  end

  defp validate_owner_target(changeset) do
    owner = get_field(changeset, :owner)
    target_type = get_field(changeset, :target_type)
    community_id = get_field(changeset, :community_id)

    cond do
      owner == :cms and target_type == :user ->
        add_error(changeset, :target_type, "is not owned by CMS")

      owner == :accounts and target_type != :user ->
        add_error(changeset, :target_type, "is not owned by Accounts")

      target_type == :doc and not is_nil(community_id) ->
        add_error(changeset, :community_id, "Doc items use the platform scope")

      true ->
        changeset
    end
  end

  defp validate_sus_notes(changeset) do
    validate_change(changeset, :sus_notes, fn :sus_notes, value ->
      if is_list(value) and length(value) <= 20 and Enum.all?(value, &valid_note?/1) do
        []
      else
        [sus_notes: "contains an invalid opinion"]
      end
    end)
  end

  defp valid_note?(note) when is_map(note) do
    type = Map.get(note, "type", Map.get(note, :type))
    evidence = Map.get(note, "evidence", Map.get(note, :evidence))
    explanation = Map.get(note, "explanation", Map.get(note, :explanation))

    type in ["spam", "harassment", "illegal_content", "impersonation", "other"] and
      is_binary(evidence) and String.length(evidence) <= 500 and is_binary(explanation) and
      String.length(explanation) <= 1_000
  end

  defp valid_note?(_note), do: false
end
