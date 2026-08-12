defmodule GroupherServer.CMS.Model.CommunityApplicationEvent do
  @moduledoc "Append-only state transition event for a community application."

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.CommunityApplication
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime, updated_at: false]
  @actor_types ~w(applicant reviewer job system)a
  @statuses CommunityApplication.statuses()
  @required_fields ~w(application_id to_status actor_type occurred_at)a
  @optional_fields ~w(from_status actor_id reason_code operation_ref metadata)a

  @type t :: %__MODULE__{}

  schema "community_application_events" do
    belongs_to(:application, CommunityApplication)
    belongs_to(:actor, User)
    field(:from_status, Ecto.Enum, values: @statuses)
    field(:to_status, Ecto.Enum, values: @statuses)
    field(:actor_type, Ecto.Enum, values: @actor_types)
    field(:reason_code, :string)
    field(:operation_ref, :string)
    field(:metadata, :map, default: %{})
    field(:occurred_at, :utc_datetime)
    timestamps(type: :utc_datetime, updated_at: false)
  end

  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = event, attrs) do
    event
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:actor_type, @actor_types)
    |> validate_job_actor()
    |> foreign_key_constraint(:application_id)
    |> foreign_key_constraint(:actor_id)
  end

  defp validate_job_actor(changeset) do
    case get_field(changeset, :actor_type) do
      :job ->
        changeset
        |> validate_required([:operation_ref])
        |> put_change(:actor_id, nil)

      actor_type when actor_type in [:applicant, :reviewer] ->
        validate_required(changeset, [:actor_id])

      _ ->
        changeset
    end
  end
end
