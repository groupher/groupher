defmodule GroupherServer.CMS.Model.DocCoverGroup do
  @moduledoc """
  One public docs cover section.

      doc_cover_groups.group_id
              |
              v
      doc_tree_nodes(type=group, published)

  The group keeps cover ordering and cover-local UI config. Titles and child
  pages are projected from the published tree.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Community, DocTreeNode}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id group_id index)a
  @optional_fields ~w(ui_config)a

  @type t :: %DocCoverGroup{}
  schema "doc_cover_groups" do
    belongs_to(:community, Community)
    belongs_to(:group, DocTreeNode)

    field(:index, :integer, default: 0)
    field(:ui_config, :map, default: %{})

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%DocCoverGroup{} = group, attrs) do
    group
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:index, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:group_id)
    |> unique_constraint(:group_id, name: :doc_cover_groups_community_group_index)
  end

  @doc false
  def update_changeset(%DocCoverGroup{} = group, attrs), do: changeset(group, attrs)
end
