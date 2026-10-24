defmodule GroupherServer.AlertWall.Model.Action do
  @moduledoc """
  Append-only record of adding, resolving or superseding one Wall item.

  Business position:

      AlertWall.Persist transition
        -> Action append-only row
          -> item history
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.{Accounts, AlertWall}
  alias Accounts.Model.User
  alias AlertWall.Model.Item
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.alert_wall()
  @actions [:add, :resolve, :supersede]
  @sources [:human, :cms, :accounts]
  @primary_key {:id, :id, autogenerate: true}

  @type t :: %__MODULE__{}

  schema "actions" do
    belongs_to(:item, Item)
    field(:action, Ecto.Enum, values: @actions)
    field(:source, Ecto.Enum, values: @sources)
    belongs_to(:actor, User)
    field(:operation_ref, Ecto.UUID)
    field(:request_digest, :string)
    field(:result, :map)
    field(:note, :string)
    field(:resource_result_ref, :string)
    timestamps(type: :utc_datetime)
  end

  def changeset(action, attrs) do
    action
    |> cast(attrs, [
      :item_id,
      :action,
      :source,
      :actor_id,
      :operation_ref,
      :request_digest,
      :result,
      :note,
      :resource_result_ref
    ])
    |> validate_required([:item_id, :action, :source, :operation_ref, :request_digest])
    |> validate_length(:note, max: 2_000)
    |> validate_length(:request_digest, max: 128)
    |> foreign_key_constraint(:item_id)
    |> foreign_key_constraint(:actor_id)
    |> unique_constraint([:operation_ref, :action])
  end
end
