defmodule GroupherServer.CMS.Model.DocTreeTrashItem do
  @moduledoc """
  Docs-only trash snapshot for deleted tree nodes.

  Docs trash is not part of Article common because docs deletion needs to carry
  both the article draft and the Tree placement. Other article threads keep
  their existing mark-delete behavior.

      delete page/link/group
              |
              v
      doc_tree_trash_items(node_snapshot)
              |
              v
      restore re-inserts doc_tree_nodes(stage=draft) with same node_id

  The database row id may change on restore, but `node_id`, article draft id,
  and article public id remain the product identities.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Community}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id node_id node_snapshot deleted_at)a
  @optional_fields ~w(
    doc_id deleted_from_group_id
    deleted_from_index deleted_by_id restored_at
  )a

  @type t :: %DocTreeTrashItem{}

  schema "doc_tree_trash_items" do
    belongs_to(:community, Community)
    field(:doc_id, Ecto.UUID)
    belongs_to(:deleted_by, User)

    field(:node_id, :string)
    field(:node_snapshot, :map)
    field(:deleted_from_group_id, :string)
    field(:deleted_from_index, :integer)
    field(:deleted_at, :utc_datetime)
    field(:restored_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc """
  Builds a trash snapshot changeset.

  ## Examples

      iex> DocTreeTrashItem.changeset(%DocTreeTrashItem{}, %{node_id: "n1", node_snapshot: %{}})
      %Ecto.Changeset{}
  """
  def changeset(%DocTreeTrashItem{} = item, attrs) do
    item
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_length(:node_id, min: 1, max: 80)
    |> validate_number(:deleted_from_index, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:deleted_by_id)
  end

  @doc """
  Builds an update changeset for restore bookkeeping.

  ## Examples

      iex> DocTreeTrashItem.update_changeset(item, %{restored_at: DateTime.utc_now()})
      %Ecto.Changeset{}
  """
  def update_changeset(%DocTreeTrashItem{} = item, attrs) do
    item
    |> cast(attrs, [:restored_at])
  end
end
