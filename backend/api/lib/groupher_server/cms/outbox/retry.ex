defmodule GroupherServer.CMS.Outbox.Retry do
  @moduledoc """
  Records one successful, generation-fenced Outbox recovery attempt.

  The row is both a one-per-failure-generation credential and a compact audit
  fact. It deliberately excludes event payloads and provider response bodies.

      failed Outbox generation -> one retry fact -> replay fenced by unique key
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  schema "outbox_retries" do
    field(:event_id, Ecto.UUID)
    field(:failure_generation, :integer)
    field(:initiator_kind, :string)
    field(:actor_id, :integer)
    field(:reason, :string)
    field(:owner_ref, :string)
    field(:reason_code, :string)
    field(:failed_error_code, :string)
    field(:failed_error_at, :utc_datetime)
    field(:original_operation_ref, Ecto.UUID)
    field(:retry_operation_ref, Ecto.UUID)
    field(:occurred_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(retry, attrs) do
    retry
    |> cast(attrs, [
      :event_id,
      :failure_generation,
      :initiator_kind,
      :actor_id,
      :reason,
      :owner_ref,
      :reason_code,
      :failed_error_code,
      :failed_error_at,
      :original_operation_ref,
      :retry_operation_ref,
      :occurred_at
    ])
    |> validate_required([
      :event_id,
      :failure_generation,
      :initiator_kind,
      :failed_error_code,
      :failed_error_at,
      :original_operation_ref,
      :retry_operation_ref,
      :occurred_at
    ])
    |> validate_inclusion(:initiator_kind, ["user", "owner"])
    |> validate_number(:failure_generation, greater_than: 0)
    |> validate_user_or_owner()
    |> unique_constraint([:event_id, :failure_generation],
      name: :outbox_retries_event_generation_index
    )
    |> foreign_key_constraint(:event_id, name: :outbox_retries_event_id_fkey)
  end

  defp validate_user_or_owner(changeset) do
    case get_field(changeset, :initiator_kind) do
      "user" ->
        changeset
        |> validate_required([:actor_id, :reason])
        |> validate_change(:owner_ref, fn :owner_ref, value ->
          if is_nil(value), do: [], else: [owner_ref: "must be absent for user retries"]
        end)
        |> validate_change(:reason_code, fn :reason_code, value ->
          if is_nil(value), do: [], else: [reason_code: "must be absent for user retries"]
        end)

      "owner" ->
        changeset
        |> validate_required([:owner_ref, :reason_code])
        |> validate_change(:actor_id, fn :actor_id, value ->
          if is_nil(value), do: [], else: [actor_id: "must be absent for owner retries"]
        end)
        |> validate_change(:reason, fn :reason, value ->
          if is_nil(value), do: [], else: [reason: "must be absent for owner retries"]
        end)

      _ ->
        changeset
    end
  end
end
