defmodule GroupherServer.CMS.Outbox.Event do
  @moduledoc """
  Durable intent for one post-commit CMS effect.

      domain transaction -> Outbox.Event -> Oban worker -> external effect

  The event stores only bounded, versioned data needed by its worker. It is not
  an audit record and must not contain complete domain snapshots or secrets.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @statuses [:pending, :executing, :completed, :failed, :dead]

  @primary_key {:id, :binary_id, autogenerate: false}

  schema "outbox_events" do
    field(:event, :string)
    field(:contract_version, :integer, default: 1)
    field(:resource_type, :string)
    field(:resource_id, :string)
    # Kept under the legacy column name while the database contract migrates;
    # `identity_type` distinguishes a user command from a maintenance workflow.
    field(:command_id, :string)
    field(:identity_type, Ecto.Enum, values: [:command, :workflow], default: :command)
    field(:effect_key, :string, default: "default")
    field(:data, :map, default: %{})
    field(:status, Ecto.Enum, values: @statuses, default: :pending)
    field(:attempts, :integer, default: 0)
    field(:available_at, :utc_datetime)
    field(:locked_at, :utc_datetime)
    field(:locked_by, :string)
    field(:completed_at, :utc_datetime)
    field(:last_error_code, :string)
    field(:last_error_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(event, attrs) do
    event
    |> cast(attrs, [
      :id,
      :event,
      :contract_version,
      :resource_type,
      :resource_id,
      :command_id,
      :identity_type,
      :effect_key,
      :data,
      :status,
      :attempts,
      :available_at,
      :locked_at,
      :locked_by,
      :completed_at,
      :last_error_code,
      :last_error_at
    ])
    |> validate_required([
      :id,
      :event,
      :contract_version,
      :resource_type,
      :resource_id,
      :command_id,
      :identity_type,
      :effect_key,
      :data,
      :status,
      :attempts,
      :available_at
    ])
    |> validate_number(:contract_version, greater_than: 0)
    |> validate_number(:attempts, greater_than_or_equal_to: 0)
    |> validate_inclusion(:identity_type, [:command, :workflow])
    |> unique_constraint(:id, name: :outbox_events_pkey)
    |> unique_constraint(
      [:identity_type, :command_id, :event, :resource_type, :resource_id, :effect_key],
      name: :outbox_events_command_event_resource_index
    )
  end
end
