defmodule GroupherServer.CMS.Model.DocCoverItem do
  @moduledoc """
  One page shown inside a docs cover section.

      doc_cover_groups
             |
             v
      doc_cover_items.node_id  --->  doc_tree_nodes(type=page, published)

  `hidden` and `ui_config` are cover-local. They survive future publish sync.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Community, DocCoverGroup, DocTreeNode}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id cover_group_id node_id index)a
  @optional_fields ~w(hidden ui_config)a

  @type t :: %DocCoverItem{}
  schema "doc_cover_items" do
    belongs_to(:community, Community)
    belongs_to(:cover_group, DocCoverGroup)
    belongs_to(:node, DocTreeNode)

    field(:index, :integer, default: 0)
    field(:hidden, :boolean, default: false)
    field(:ui_config, :map, default: %{})

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%DocCoverItem{} = item, attrs) do
    item
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:index, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:cover_group_id)
    |> foreign_key_constraint(:node_id)
    |> unique_constraint(:node_id, name: :doc_cover_items_cover_group_node_index)
  end

  @doc false
  def update_changeset(%DocCoverItem{} = item, attrs), do: changeset(item, attrs)
end
