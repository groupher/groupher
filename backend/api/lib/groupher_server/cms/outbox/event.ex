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
  @primary_key {:id, :binary_id, autogenerate: false}

  schema "outbox_events" do
    field(:event, :string)
    field(:contract_version, :integer, default: 1)
    field(:worker, :string)
    field(:resource_type, :string)
    field(:resource_id, :string)
    field(:operation_ref, Ecto.UUID)
    field(:dedupe_key, :string)
    field(:failure_generation, :integer, default: 0)
    field(:data, :map, default: %{})
    field(:status, GroupherServer.CMS.Outbox.Status, default: :waiting)
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
  def project_fields(data, fields) when is_map(data) and is_list(fields) do
    Enum.reduce_while(fields, {:ok, %{}}, fn field, {:ok, projected} ->
      case Map.fetch(data, field) do
        {:ok, value} -> {:cont, {:ok, Map.put(projected, field, value)}}
        :error -> {:halt, {:error, {:outbox_payload_field_missing, field}}}
      end
    end)
  end

  @doc false
  def changeset(event, attrs) do
    event
    |> cast(attrs, [
      :id,
      :event,
      :contract_version,
      :worker,
      :resource_type,
      :resource_id,
      :operation_ref,
      :dedupe_key,
      :failure_generation,
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
      :worker,
      :resource_type,
      :resource_id,
      :operation_ref,
      :dedupe_key,
      :failure_generation,
      :data,
      :status,
      :attempts,
      :available_at
    ])
    |> validate_number(:contract_version, greater_than: 0)
    |> validate_number(:attempts, greater_than_or_equal_to: 0)
    |> validate_number(:failure_generation, greater_than_or_equal_to: 0)
    |> validate_change(:worker, fn :worker, worker ->
      if String.trim(worker) == "", do: [worker: "must be non-blank"], else: []
    end)
    |> validate_change(:dedupe_key, fn :dedupe_key, key ->
      if String.trim(key) == "", do: [dedupe_key: "must be non-blank"], else: []
    end)
    |> unique_constraint(:id, name: :outbox_events_pkey)
    |> unique_constraint(
      [:event, :resource_type, :resource_id, :dedupe_key],
      name: :outbox_events_event_resource_dedupe_index
    )
    |> check_constraint(:worker, name: :outbox_events_worker_non_blank_check)
  end
end
