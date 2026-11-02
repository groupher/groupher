defmodule GroupherServer.CMS.Model.TicketState do
  @moduledoc """
  Mutable Ticket-specific workflow facts for an Article identity.

      Article + one ArticleBinding
        -> TicketState workflow facts
        -> Ticket Commands, Gate and projections
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.{Article, ArticleBinding}
  alias Helper.Constant.DBPrefix

  @primary_key {:article_id, Ecto.UUID, autogenerate: false}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @types [:user, :worker, :case]
  @statuses [:todo, :wip, :done, :open, :resolved]

  schema "ticket_states" do
    belongs_to(:article, Article, primary_key: true, define_field: false)
    belongs_to(:article_binding, ArticleBinding, type: :id)
    field(:type, Ecto.Enum, values: @types)
    field(:status, Ecto.Enum, values: @statuses)
    field(:priority, :integer, default: 1)
    field(:planned_start_at, :utc_datetime)
    field(:planned_end_at, :utc_datetime)
    field(:started_at, :utc_datetime)
    field(:completed_at, :utc_datetime)
    field(:rank, :integer, default: 0)
    field(:workflow_version, :integer, default: 1)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds a Ticket state and validates fields that do not need database facts."
  def changeset(state, attrs) do
    state
    |> cast(attrs, [
      :article_id,
      :article_binding_id,
      :type,
      :status,
      :priority,
      :planned_start_at,
      :planned_end_at,
      :started_at,
      :completed_at,
      :rank,
      :workflow_version
    ])
    |> validate_required([
      :article_id,
      :article_binding_id,
      :type,
      :status,
      :priority,
      :rank,
      :workflow_version
    ])
    |> validate_number(:priority, greater_than_or_equal_to: 0, less_than_or_equal_to: 3)
    |> validate_number(:workflow_version, greater_than: 0)
    |> check_constraint(:status, name: :ticket_states_type_status_check)
    |> check_constraint(:planned_end_at, name: :ticket_states_planned_window_check)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:article_binding_id)
  end

  @doc "Returns the allowed business types."
  def types, do: @types

  @doc "Returns the allowed work statuses."
  def statuses, do: @statuses
end
