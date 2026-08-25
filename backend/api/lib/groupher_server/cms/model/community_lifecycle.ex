defmodule GroupherServer.CMS.Model.CommunityLifecycle do
  require GroupherServer.CMS.Communities.Const
  @moduledoc """
  Public availability lifecycle for a community created from an application.

  Business position:

      CMS context
        -> CommunityLifecycle schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Communities.Const
  alias GroupherServer.CMS.Model.{Community, CommunityApplication, CommunityLifecycleBlocker}
  alias Helper.Constant.DBPrefix

  require Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @states Const.lifecycle_state_values()
  @required_fields ~w(community_id state version)a
  @optional_fields ~w(application_id activated_at changed_at archived_at destroy_scheduled_at destroyed_at failed_at last_error)a

  @type t :: %__MODULE__{}

  schema "community_lifecycles" do
    belongs_to(:community, Community)
    belongs_to(:application, CommunityApplication)
    field(:state, Ecto.Enum, values: @states, default: :setting_up)
    field(:version, :integer, default: 1)
    field(:activated_at, :utc_datetime)
    field(:changed_at, :utc_datetime)
    field(:archived_at, :utc_datetime)
    field(:destroy_scheduled_at, :utc_datetime)
    field(:destroyed_at, :utc_datetime)
    field(:failed_at, :utc_datetime)
    field(:last_error, :map)
    has_many(:blockers, CommunityLifecycleBlocker, foreign_key: :lifecycle_id)
    timestamps(type: :utc_datetime)
  end

  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = lifecycle, attrs) do
    lifecycle
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:state, @states)
    |> validate_number(:version, greater_than: 0)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:application_id)
    |> unique_constraint(:community_id)
    |> unique_constraint(:application_id)
  end
end
