defmodule GroupherServer.CMS.CommunityApplications.Transitions do
  @moduledoc """
  Single authority for Application state transitions and Event writes.

  Business position:

      Apply UI / reviewer
        -> GraphQL resolver
        -> CMS.CommunityApplications
        -> Transitions
        -> Repo / Oban
  """

  alias Ecto.Multi
  alias GroupherServer.CMS.Model.{CommunityApplication, CommunityApplicationEvent}

  @allowed %{
    submitted: ~w(reviewing cancelled expired)a,
    reviewing: ~w(approved rejected cancelled)a,
    approved: ~w(setting_up creation_failed)a,
    creation_failed: ~w(approved)a,
    setting_up: ~w(created setup_failed)a,
    setup_failed: ~w(setting_up)a
  }

  @doc """
  Returns whether the Application state transition is allowed.

  ## Examples

      CMS.CommunityApplications.Transitions.allowed?(:submitted, :reviewing)
      #=> true

      CMS.CommunityApplications.Transitions.allowed?(:submitted, :approved)
      #=> false

  """
  @spec allowed?(CommunityApplication.status(), CommunityApplication.status()) :: boolean()
  def allowed?(from, to), do: to in Map.get(@allowed, from, [])

  @doc """
  Adds the Application status update and its Event write to the Multi.

  When the transition is not allowed the Multi is failed with
  `:application_state_conflict`.

  ## Examples

      CMS.CommunityApplications.Transitions.add(
        Ecto.Multi.new(),
        :application,
        :event,
        application,
        :reviewing,
        %{},
        %{type: :reviewer, id: 1, occurred_at: DateTime.utc_now(:second)}
      )
      #=> %Ecto.Multi{}

  """
  @spec add(Multi.t(), atom(), atom(), CommunityApplication.t(), atom(), map(), map()) ::
          Multi.t()
  def add(
        multi,
        application_key,
        event_key,
        %CommunityApplication{} = application,
        to,
        attrs,
        actor
      ) do
    if allowed?(application.status, to) do
      now = Map.get(actor, :occurred_at, DateTime.utc_now(:second))

      update_attrs =
        attrs
        |> Map.put(:status, to)
        |> Map.put(:version, application.version + 1)

      multi
      |> Multi.update(application_key, CommunityApplication.changeset(application, update_attrs))
      |> Multi.insert(event_key, fn changes ->
        updated_application = Map.fetch!(changes, application_key)

        CommunityApplicationEvent.changeset(%CommunityApplicationEvent{}, %{
          application_id: updated_application.id,
          from_status: application.status,
          to_status: to,
          actor_type: Map.fetch!(actor, :type),
          actor_id: Map.get(actor, :id),
          reason_code: Map.get(actor, :reason_code),
          operation_ref: Map.get(actor, :operation_ref),
          metadata: Map.get(actor, :metadata, %{}),
          occurred_at: now
        })
      end)
    else
      Multi.error(multi, application_key, :application_state_conflict)
    end
  end

  @spec initial_event_changeset(CommunityApplication.t(), map()) :: Ecto.Changeset.t()
  def initial_event_changeset(%CommunityApplication{} = application, actor) do
    CommunityApplicationEvent.changeset(%CommunityApplicationEvent{}, %{
      application_id: application.id,
      from_status: nil,
      to_status: :submitted,
      actor_type: Map.fetch!(actor, :type),
      actor_id: Map.get(actor, :id),
      operation_ref: Map.get(actor, :operation_ref),
      metadata: Map.get(actor, :metadata, %{}),
      occurred_at: Map.get(actor, :occurred_at, DateTime.utc_now(:second))
    })
  end
end
