defmodule GroupherServer.CMS.Model.DocCoverPinnedItem do
  @moduledoc """
  One top-level pinned docs cover card.

      doc_cover_pinned_items.node_id  --->  doc_tree_nodes(type=page, published)
                    |
                    +-- ui_config(color / gradient / image / future config)

  Pinned items are independent from cover groups. A doc can be pinned even when
  its parent group is not included in the normal cover sections.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Community, DocTreeNode}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id node_id index)a
  @optional_fields ~w(ui_config)a

  @type t :: %DocCoverPinnedItem{}
  schema "doc_cover_pinned_items" do
    belongs_to(:community, Community)
    belongs_to(:node, DocTreeNode)

    field(:index, :integer, default: 0)
    field(:ui_config, :map, default: %{})

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%DocCoverPinnedItem{} = item, attrs) do
    item
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:index, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:node_id)
    |> unique_constraint(:node_id, name: :doc_cover_pinned_items_community_node_index)
  end

  @doc false
  def update_changeset(%DocCoverPinnedItem{} = item, attrs), do: changeset(item, attrs)
end
