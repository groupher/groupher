defmodule GroupherServer.CMS.Model.CommunityLifecycleBlocker do
  @moduledoc """
  An active or ended restriction contributing to a Community Lifecycle state.

  Business position:

      CMS context
        -> CommunityLifecycleBlocker schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.{Const, Model}
  alias GroupherServer.CMS.Model.CommunityLifecycle
  alias Helper.Constant.DBPrefix

  require Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @required_fields ~w(community_id lifecycle_id blocker_type cause_code applied_at created_by_operation_ref version)a
  @optional_fields ~w(cause_ref recover_until ended_at end_type ended_by_operation_ref)a

  @type t :: %__MODULE__{}

  schema "community_lifecycle_blockers" do
    belongs_to(:community, Model.Community)
    belongs_to(:lifecycle, CommunityLifecycle)
    field(:blocker_type, Ecto.Enum, values: Const.lifecycle_blocker_type_values())
    field(:cause_code, :string)
    field(:cause_ref, :string)
    field(:recover_until, :utc_datetime)
    field(:applied_at, :utc_datetime)
    field(:ended_at, :utc_datetime)
    field(:end_type, Ecto.Enum, values: Const.lifecycle_blocker_end_type_values())
    field(:created_by_operation_ref, :string)
    field(:ended_by_operation_ref, :string)
    field(:version, :integer, default: 1)
    timestamps(type: :utc_datetime)
  end

  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = blocker, attrs) do
    blocker
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:blocker_type, Const.lifecycle_blocker_type_enum_values())
    |> validate_inclusion(:end_type, Const.lifecycle_blocker_end_type_enum_values())
    |> validate_number(:version, greater_than: 0)
    |> validate_length(:cause_code, min: 1, max: 120)
    |> validate_length(:cause_ref, max: 120)
    |> validate_length(:created_by_operation_ref, min: 8, max: 120)
    |> validate_length(:ended_by_operation_ref, max: 120)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:lifecycle_id)
    |> unique_constraint(:cause_ref, name: :community_lifecycle_blockers_active_unique)
    |> unique_constraint(:cause_ref, name: :community_lifecycle_blockers_active_cause_unique)
    |> unique_constraint(:created_by_operation_ref,
      name: :community_lifecycle_blockers_operation_ref_index
    )
  end
end
