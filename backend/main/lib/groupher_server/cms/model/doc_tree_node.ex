defmodule GroupherServer.CMS.Model.DocTreeNode do
  @moduledoc """
  Versioned docs tree node.

  The tree keeps one logical identity (`node_id`) and two materialized stages:

      doc_tree_nodes(stage=draft)          doc_tree_nodes(stage=public)
      --------------------------- publish  ----------------------------
      tab node_id=introduction              tab node_id=introduction
        group tab_id=introduction             group tab_id=introduction
          page group_id=group_1                 page group_id=group_1
        pin tab_id=introduction               pin tab_id=introduction

  `id` is a physical database row id. Callers should use `node_id` for tree
  identity, `tab_id` for Group/Pin ownership, and `group_id` for Page/Link
  ownership. Pins are independent copied link nodes, not shared references.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Marker
  alias CMS.Model.{Community, ArticleBranch}
  alias Helper.Constant.DBPrefix
  alias Helper.Validator.Slug

  require CMS.Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id branch_id node_id stage type index)a
  @optional_fields ~w(
    tab_id group_id doc_id title slug href marker badge
    hidden template_key ui_config
  )a

  @type node_type :: :tab | :group | :page | :link | :pin
  @type stage :: :draft | :public
  @type t :: %DocTreeNode{}

  schema "doc_tree_nodes" do
    belongs_to(:community, Community)
    belongs_to(:branch, ArticleBranch)

    field(:doc_id, Ecto.UUID)
    field(:node_id, :string)
    field(:stage, Ecto.Enum, values: CMS.Const.stage_values())
    field(:type, Ecto.Enum, values: CMS.Const.tree_node_type_values())
    field(:tab_id, :string)
    field(:group_id, :string)
    field(:title, :string)
    field(:slug, :string)
    field(:index, :integer, default: 0)
    field(:href, :string)
    field(:marker, :map)
    field(:badge, :string)
    field(:hidden, :boolean, default: false)
    field(:template_key, :string)
    field(:ui_config, :map, default: %{})

    timestamps(type: :utc_datetime)
  end

  def node_types, do: CMS.Const.tree_node_type_enum_values()
  def stages, do: CMS.Const.stage_enum_values()

  @doc """
  Builds a changeset for creating a docs tree node.

  ## Examples

      iex> DocTreeNode.changeset(%DocTreeNode{}, %{stage: :draft, type: :group})
      %Ecto.Changeset{}
  """
  def changeset(%DocTreeNode{} = node, attrs) do
    node
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> Marker.normalize_changeset(:marker)
    |> validate_required(@required_fields)
    |> validate_common()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint(:node_id, name: :doc_tree_nodes_stage_node_id_index)
    |> unique_constraint(:template_key, name: :doc_tree_nodes_community_stage_template_key_index)
    |> unique_constraint(:slug, name: :doc_tree_nodes_root_slug_index)
    |> unique_constraint(:title, name: :doc_tree_nodes_root_title_index)
    |> unique_constraint(:slug, name: :doc_tree_nodes_sibling_slug_index)
    |> unique_constraint(:title, name: :doc_tree_nodes_sibling_title_index)
    |> unique_constraint(:slug, name: :doc_tree_nodes_tab_sibling_slug_index)
    |> unique_constraint(:title, name: :doc_tree_nodes_tab_sibling_title_index)
  end

  @doc """
  Builds a changeset for updating a docs tree node.

  ## Examples

      iex> DocTreeNode.update_changeset(node, %{title: "Guide"})
      %Ecto.Changeset{}
  """
  def update_changeset(%DocTreeNode{} = node, attrs) do
    node
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> Marker.normalize_changeset(:marker)
    |> validate_common()
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint(:node_id, name: :doc_tree_nodes_stage_node_id_index)
    |> unique_constraint(:template_key, name: :doc_tree_nodes_community_stage_template_key_index)
    |> unique_constraint(:slug, name: :doc_tree_nodes_root_slug_index)
    |> unique_constraint(:title, name: :doc_tree_nodes_root_title_index)
    |> unique_constraint(:slug, name: :doc_tree_nodes_sibling_slug_index)
    |> unique_constraint(:title, name: :doc_tree_nodes_sibling_title_index)
    |> unique_constraint(:slug, name: :doc_tree_nodes_tab_sibling_slug_index)
    |> unique_constraint(:title, name: :doc_tree_nodes_tab_sibling_title_index)
  end

  defp validate_common(changeset) do
    type = get_field(changeset, :type)
    _stage = get_field(changeset, :stage)
    group_id = get_field(changeset, :group_id)
    doc_id = get_field(changeset, :doc_id)
    href = get_field(changeset, :href)

    changeset
    |> validate_length(:node_id, min: 1, max: 80)
    |> validate_length(:tab_id, min: 1, max: 80)
    |> validate_length(:group_id, min: 1, max: 80)
    |> validate_length(:title, min: 1, max: 100)
    |> validate_length(:slug, min: 1, max: 120)
    |> validate_length(:href, max: 400)
    |> Slug.validate_changeset(:slug)
    |> validate_title_slug_ref(type)
    |> validate_parent_refs(type, get_field(changeset, :tab_id), group_id)
    |> validate_article_ref(type, doc_id)
    |> validate_link_href(type, href)
  end

  defp validate_title_slug_ref(changeset, type) when type in [:tab, :group, :page, :link, :pin],
    do: validate_required(changeset, [:title, :slug])

  defp validate_title_slug_ref(changeset, _type), do: changeset

  defp validate_parent_refs(changeset, :tab, nil, nil), do: changeset
  defp validate_parent_refs(changeset, :group, tab_id, nil) when not is_nil(tab_id), do: changeset
  defp validate_parent_refs(changeset, :pin, tab_id, nil) when not is_nil(tab_id), do: changeset

  defp validate_parent_refs(changeset, type, nil, group_id)
       when type in [:page, :link] and not is_nil(group_id),
       do: changeset

  defp validate_parent_refs(changeset, _type, _tab_id, _group_id),
    do: add_error(changeset, :type, "node has an invalid docs tree parent")

  defp validate_article_ref(changeset, :page, nil),
    do: add_error(changeset, :doc_id, "page nodes require doc_id")

  defp validate_article_ref(changeset, :page, doc_id) when not is_nil(doc_id),
    do: changeset

  defp validate_article_ref(changeset, type, doc_id)
       when type in [:tab, :group, :link, :pin] do
    if is_nil(doc_id) do
      changeset
    else
      add_error(changeset, :doc_id, "#{type} nodes can not reference articles")
    end
  end

  defp validate_article_ref(changeset, _type, _doc_id),
    do: changeset

  defp validate_link_href(changeset, type, href) when type in [:link, :pin] and is_binary(href) do
    if String.trim(href) == "" do
      add_error(changeset, :href, "#{type} nodes require href")
    else
      changeset
    end
  end

  defp validate_link_href(changeset, type, _href) when type in [:link, :pin],
    do: add_error(changeset, :href, "#{type} nodes require href")

  defp validate_link_href(changeset, type, href) when type in [:tab, :group, :page] do
    if is_nil(href) or (is_binary(href) and String.trim(href) == "") do
      changeset
    else
      add_error(changeset, :href, "#{type} nodes can not have href")
    end
  end
end
