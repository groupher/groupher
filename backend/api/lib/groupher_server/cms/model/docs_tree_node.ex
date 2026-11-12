defmodule GroupherServer.CMS.Model.DocsTreeNode do
  @moduledoc """
  Branch-free workspace or public Docs navigation node.

      Community + stage + node identity -> stable directory node
  """

  use Ecto.Schema
  import Ecto.Changeset
  alias Helper.Constant.DBPrefix
  @schema_prefix DBPrefix.cms()

  schema "doc_tree_nodes" do
    field(:community_id, :integer)
    field(:node_id, :string)
    field(:stage, Ecto.Enum, values: [:draft, :public])
    field(:type, Ecto.Enum, values: [:tab, :group, :page, :link, :pin])
    field(:parent_node_id, :string)
    field(:doc_id, Ecto.UUID)
    field(:title, :string)
    field(:index, :integer)
    field(:href, :string)
    field(:marker, :map)
    field(:badge, :string)
    field(:hidden, :boolean, default: false)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds a node after the complete target tree has been validated."
  def changeset(node, attrs) do
    node
    |> cast(attrs, [
      :community_id,
      :node_id,
      :stage,
      :type,
      :parent_node_id,
      :doc_id,
      :title,
      :index,
      :href,
      :marker,
      :badge,
      :hidden
    ])
    |> validate_required([:community_id, :node_id, :stage, :type, :title, :index])
  end
end
