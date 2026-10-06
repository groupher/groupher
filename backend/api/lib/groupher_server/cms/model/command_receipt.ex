defmodule GroupherServer.CMS.Model.CommandReceipt do
  @moduledoc """
  Durable idempotency receipt for CMS commands.

  The receipt identifies one initiator intent. Domain facts, Audit, and
  post-commit effects remain owned by their respective domains.

      command request
        -> unique initiator/command claim
        -> domain transaction
        -> finalized replay envelope
        -> bounded retention cleanup
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  schema "command_receipts" do
    field(:initiator_type, :string)
    field(:initiator_key, :string)
    field(:command_id, Ecto.UUID)
    field(:command, :string)
    field(:resource_type, :string)
    field(:resource_id, :string)
    field(:intent_params, :map)
    field(:confirmation, :map)
    field(:expires_at, :utc_datetime)
    field(:identity_expires_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @required_fields ~w(
    initiator_type
    initiator_key
    command_id
    command
    resource_type
    resource_id
    intent_params
    expires_at
  )a

  @doc false
  def changeset(receipt, attrs) do
    receipt
    |> cast(attrs, [
      :initiator_type,
      :initiator_key,
      :command_id,
      :command,
      :resource_type,
      :resource_id,
      :intent_params,
      :confirmation,
      :expires_at,
      :identity_expires_at
    ])
    |> validate_required(@required_fields)
    |> unique_constraint(
      [:initiator_type, :initiator_key, :command_id],
      name: :command_receipts_initiator_command_id_index
    )
  end
end
