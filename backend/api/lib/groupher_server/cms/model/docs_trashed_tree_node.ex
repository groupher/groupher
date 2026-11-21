defmodule GroupherServer.CMS.Model.DocsTrashedTreeNode do
  @moduledoc """
  Retains the site-owned directory node states needed for Trash recovery.

      Docs Trash operations -> DocsTrashedTreeNode schema -> cms.trashed_doc_tree_nodes
  """

  use Ecto.Schema
  require GroupherServer.CMS.DocTree.Const
  import Ecto.Changeset

  alias GroupherServer.{CMS, Accounts}
  alias CMS.Model.{Community, TrashAction}
  alias Accounts.Model.User
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  schema "trashed_doc_tree_nodes" do
    field(:hash_id, Ecto.UUID, autogenerate: true)
    belongs_to(:trash_action, TrashAction)
    belongs_to(:community, Community)
    field(:node_id, :string)
    field(:doc_id, Ecto.UUID)
    field(:type, Ecto.Enum, values: CMS.DocTree.Const.tree_node_type_values())
    field(:draft_snapshot, :map)
    field(:public_snapshot, :map)
    field(:queue_snapshot, :map)
    belongs_to(:deleted_by, User)
    field(:deleted_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  @doc "Validates the saved logical identity and at least one tree state."
  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :trash_action_id,
      :community_id,
      :node_id,
      :doc_id,
      :type,
      :draft_snapshot,
      :public_snapshot,
      :queue_snapshot,
      :deleted_by_id,
      :deleted_at
    ])
    |> validate_required([:trash_action_id, :community_id, :node_id, :type, :deleted_at])
    |> validate_length(:node_id, min: 1, max: 80)
    |> validate_snapshot()
    |> unique_constraint(:hash_id)
    |> unique_constraint([:trash_action_id, :node_id])
    |> foreign_key_constraint(:trash_action_id,
      name: :docs_cutover_trashed_node_action_owner_fkey
    )
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:doc_id)
    |> foreign_key_constraint(:deleted_by_id)
  end

  defp validate_snapshot(changeset) do
    if get_field(changeset, :draft_snapshot) || get_field(changeset, :public_snapshot) ||
         get_field(changeset, :queue_snapshot) do
      changeset
    else
      add_error(changeset, :draft_snapshot, "draft or public snapshot is required")
    end
  end
end
