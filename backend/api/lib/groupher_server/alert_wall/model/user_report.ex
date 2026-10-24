defmodule GroupherServer.AlertWall.Model.UserReport do
  @moduledoc """
  A reporter's immutable report fact tied to the Wall item for the content they reported.

  Business position:

      Reporter command
        -> immutable report target snapshot
          -> one Wall item
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.{Accounts, AlertWall, CMS}
  alias Accounts.Model.User
  alias AlertWall.Model.Item
  alias CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.alert_wall()
  @owners [:cms, :accounts]
  @target_types [:article, :comment, :doc, :user]
  @primary_key {:id, :id, autogenerate: true}

  @type t :: %__MODULE__{}

  schema "user_reports" do
    belongs_to(:item, Item)
    belongs_to(:reporter, User)
    field(:owner, Ecto.Enum, values: @owners)
    field(:target_type, Ecto.Enum, values: @target_types)
    field(:target_id, :string)
    belongs_to(:community, Community)
    field(:subject_ref, :string)
    field(:report_type, :string)
    field(:details, :string)
    field(:operation_ref, Ecto.UUID)
    field(:withdrawn_at, :utc_datetime)
    field(:outdated_at, :utc_datetime)
    field(:resolved_at, :utc_datetime)
    field(:resolution, :string)
    timestamps(type: :utc_datetime)
  end

  def changeset(report, attrs) do
    report
    |> cast(attrs, [
      :item_id,
      :reporter_id,
      :owner,
      :target_type,
      :target_id,
      :community_id,
      :subject_ref,
      :report_type,
      :details,
      :operation_ref,
      :withdrawn_at,
      :outdated_at,
      :resolved_at,
      :resolution
    ])
    |> validate_required([
      :item_id,
      :reporter_id,
      :owner,
      :target_type,
      :target_id,
      :subject_ref,
      :report_type,
      :operation_ref
    ])
    |> validate_length(:details, max: 8_000)
    |> validate_owner_target()
    |> foreign_key_constraint(:item_id)
    |> foreign_key_constraint(:reporter_id)
    |> foreign_key_constraint(:community_id)
    |> unique_constraint(:operation_ref)
    |> unique_constraint(
      [:reporter_id, :owner, :target_type, :target_id, :community_id, :subject_ref],
      name: :alert_wall_user_reports_active_community_unique
    )
    |> unique_constraint([:reporter_id, :owner, :target_type, :target_id, :subject_ref],
      name: :alert_wall_user_reports_active_system_unique
    )
    |> validate_resolution()
  end

  defp validate_resolution(changeset) do
    if is_nil(get_field(changeset, :resolved_at)) == is_nil(get_field(changeset, :resolution)) do
      changeset
    else
      add_error(changeset, :resolution, "must be set with resolved_at")
    end
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
        add_error(changeset, :community_id, "Doc reports use the platform scope")

      true ->
        changeset
    end
  end
end
