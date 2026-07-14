defmodule GroupherServer.CMS.Model.TrashedDocTreeNode do
  @moduledoc """
  Docs-only structural recovery state for one logical Tree node.

  Nullable draft/public snapshots retain the stage-specific placement without
  copying Article content into the Tree Trash model.
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias GroupherServer.CMS.Model.{ArticleBranch, Community, TrashAction}
  alias Helper.Constant.DBPrefix

  require CMS.Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @required_fields ~w(trash_action_id community_id branch_id node_id type deleted_at)a
  @optional_fields ~w(doc_id draft_snapshot public_snapshot deleted_by_id)a

  @type t :: %__MODULE__{}

  schema "trashed_doc_tree_nodes" do
    field(:hash_id, Ecto.UUID, autogenerate: true)
    belongs_to(:trash_action, TrashAction)
    belongs_to(:community, Community)
    belongs_to(:branch, ArticleBranch)
    field(:node_id, :string)
    field(:doc_id, Ecto.UUID)
    field(:type, Ecto.Enum, values: CMS.Const.tree_node_type_values())
    field(:draft_snapshot, :map)
    field(:public_snapshot, :map)
    belongs_to(:deleted_by, User)
    field(:deleted_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  def changeset(node, attrs) do
    node
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_length(:node_id, min: 1, max: 80)
    |> validate_snapshot()
    |> unique_constraint(:hash_id)
    |> unique_constraint([:trash_action_id, :node_id],
      name: :trashed_doc_tree_nodes_action_node_index
    )
    |> foreign_key_constraint(:trash_action_id)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:deleted_by_id)
  end

  defp validate_snapshot(changeset) do
    if get_field(changeset, :draft_snapshot) || get_field(changeset, :public_snapshot) do
      changeset
    else
      add_error(changeset, :draft_snapshot, "draft or public snapshot is required")
    end
  end
end
