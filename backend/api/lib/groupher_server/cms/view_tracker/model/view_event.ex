defmodule GroupherServer.CMS.ViewTracker.Model.ViewEvent do
  @moduledoc """
  Durable Article view decision and projection event.

      CMS.ViewTracker -> ViewEvent -> cms.view_events
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Artiment.Threads
  alias GroupherServer.CMS.ViewTracker.Const
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @primary_key false

  schema "view_events" do
    field(:event_id, Ecto.UUID, primary_key: true, autogenerate: false)
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:article_id, :id)
    field(:community_id, :id)
    belongs_to(:user, User, foreign_key: :user_id)
    field(:viewer_tracking_key, :binary)
    field(:actor_type, Ecto.Enum, values: GroupherServer.Actor.Const.actor_types())
    field(:is_authenticated, :boolean, default: false)
    field(:actor_confidence, Ecto.Enum, values: Const.actor_confidences())
    field(:classified_by, Ecto.Enum, values: Const.classified_by())

    field(:occurred_at, :utc_datetime)
    field(:policy_version, :integer, default: 1)
    field(:counted, :boolean, default: true)
    field(:decision_reason, Ecto.Enum, values: Const.decision_reasons())
    field(:read_purpose, Ecto.Enum, values: Const.read_purposes())
    field(:projected_at, :utc_datetime)
    field(:failed_at, :utc_datetime)
    field(:failure_reason, :string)
    field(:retry_count, :integer, default: 0)
    field(:projection_state, Ecto.Enum, values: Const.projection_states(), default: :pending)
    field(:projection_generation, :integer, default: 1)
    field(:current_projection_job_id, :integer)
    field(:projection_retry_deadline_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%__MODULE__{} = event, attrs) do
    event
    |> cast(attrs, [
      :event_id,
      :thread,
      :article_id,
      :community_id,
      :user_id,
      :viewer_tracking_key,
      :actor_type,
      :is_authenticated,
      :actor_confidence,
      :classified_by,
      :occurred_at,
      :policy_version,
      :counted,
      :decision_reason,
      :read_purpose,
      :projected_at
    ])
    |> validate_required([
      :event_id,
      :thread,
      :article_id,
      :actor_type,
      :is_authenticated,
      :actor_confidence,
      :classified_by,
      :occurred_at,
      :policy_version,
      :counted,
      :decision_reason,
      :read_purpose
    ])
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:event_id, name: :view_events_pkey)
  end
end
