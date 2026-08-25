defmodule GroupherServer.CMS.Model.DocCoverCard do
  @moduledoc """
  One public docs Cover Card.

      doc_cover_cards.group_node_id
              |
              v
      doc_tree_nodes(type=group, published)

  The Card keeps cover ordering and cover-local appearance. Its title and
  direct Page/Link/Group items are projected from the published Group.

  Business position:

      CMS context
        -> DocCoverCard schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Community, DocTreeNode}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id group_node_id index)a
  @optional_fields ~w(appearance)a

  @type t :: %__MODULE__{}
  schema "doc_cover_cards" do
    belongs_to(:community, Community)
    belongs_to(:group_node, DocTreeNode)

    field(:index, :integer, default: 0)
    field(:appearance, :map, default: %{})

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%__MODULE__{} = card, attrs) do
    card
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:index, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:group_node_id)
    |> unique_constraint(:group_node_id, name: :doc_cover_cards_community_group_node_index)
  end

  @doc false
  def update_changeset(%__MODULE__{} = card, attrs), do: changeset(card, attrs)
end
