defmodule GroupherServer.CMS.Model.DocTreeNode do
  @moduledoc """
  Versioned docs tree node.

  The tree keeps one logical identity (`node_id`) and two materialized stages:

      doc_tree_nodes(stage=draft)          doc_tree_nodes(stage=public)
      --------------------------- publish  ----------------------------
      group node_id=group_1                 group node_id=group_1
        page group_id=group_1                 page group_id=group_1
      pin node_id=github                    pin node_id=github

  `id` is a physical database row id. Callers should use `node_id` for tree
  identity and `group_id` for parent group membership. Pins are independent
  top-level link nodes, not soft links to page/link nodes.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Marker
  alias CMS.Model.{ArticleWorkspace, Community, Doc}
  alias Helper.Constant.DBPrefix
  alias Helper.Validator.Slug

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @node_types [:group, :page, :link, :pin]
  @stages [:draft, :public]
  @required_fields ~w(community_id node_id stage type index)a
  @optional_fields ~w(
    group_id workspace_id doc_id title slug href marker badge
    hidden template_key ui_config
  )a

  @type node_type :: :group | :page | :link | :pin
  @type stage :: :draft | :public
  @type t :: %DocTreeNode{}

  schema "doc_tree_nodes" do
    belongs_to(:community, Community)
    belongs_to(:workspace, ArticleWorkspace)
    belongs_to(:doc, Doc)

    field(:node_id, :string)
    field(:stage, Ecto.Enum, values: @stages)
    field(:type, Ecto.Enum, values: @node_types)
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

  def node_types, do: @node_types
  def stages, do: @stages

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
    |> foreign_key_constraint(:workspace_id)
    |> foreign_key_constraint(:doc_id)
    |> unique_constraint(:node_id, name: :doc_tree_nodes_stage_node_id_index)
    |> unique_constraint(:template_key, name: :doc_tree_nodes_community_stage_template_key_index)
    |> unique_constraint(:slug, name: :doc_tree_nodes_root_slug_index)
    |> unique_constraint(:title, name: :doc_tree_nodes_root_title_index)
    |> unique_constraint(:slug, name: :doc_tree_nodes_sibling_slug_index)
    |> unique_constraint(:title, name: :doc_tree_nodes_sibling_title_index)
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
    |> foreign_key_constraint(:workspace_id)
    |> foreign_key_constraint(:doc_id)
    |> unique_constraint(:node_id, name: :doc_tree_nodes_stage_node_id_index)
    |> unique_constraint(:template_key, name: :doc_tree_nodes_community_stage_template_key_index)
    |> unique_constraint(:slug, name: :doc_tree_nodes_root_slug_index)
    |> unique_constraint(:title, name: :doc_tree_nodes_root_title_index)
    |> unique_constraint(:slug, name: :doc_tree_nodes_sibling_slug_index)
    |> unique_constraint(:title, name: :doc_tree_nodes_sibling_title_index)
  end

  defp validate_common(changeset) do
    type = get_field(changeset, :type)
    stage = get_field(changeset, :stage)
    group_id = get_field(changeset, :group_id)
    workspace_id = get_field(changeset, :workspace_id)
    doc_id = get_field(changeset, :doc_id)
    href = get_field(changeset, :href)

    changeset
    |> validate_length(:node_id, min: 1, max: 80)
    |> validate_length(:group_id, min: 1, max: 80)
    |> validate_length(:title, min: 1, max: 100)
    |> validate_length(:slug, min: 1, max: 120)
    |> validate_length(:href, max: 400)
    |> Slug.validate_changeset(:slug)
    |> validate_title_slug_ref(type)
    |> validate_group_ref(type, group_id)
    |> validate_article_ref(type, stage, workspace_id, doc_id)
    |> validate_link_href(type, href)
  end

  defp validate_title_slug_ref(changeset, type) when type in [:group, :page, :link, :pin],
    do: validate_required(changeset, [:title, :slug])

  defp validate_title_slug_ref(changeset, _type), do: changeset

  defp validate_group_ref(changeset, :group, nil), do: changeset

  defp validate_group_ref(changeset, :group, _group_id),
    do: add_error(changeset, :group_id, "group nodes must be root nodes")

  defp validate_group_ref(changeset, :pin, nil), do: changeset

  defp validate_group_ref(changeset, :pin, _group_id),
    do: add_error(changeset, :group_id, "pin nodes must be top-level nodes")

  defp validate_group_ref(changeset, type, nil) when type in [:page, :link],
    do: add_error(changeset, :group_id, "#{type} nodes must belong to a group")

  defp validate_group_ref(changeset, _type, _group_id), do: changeset

  defp validate_article_ref(changeset, :page, :draft, workspace_id, nil)
       when not is_nil(workspace_id),
       do: changeset

  defp validate_article_ref(changeset, :page, :public, nil, doc_id) when not is_nil(doc_id),
    do: changeset

  defp validate_article_ref(changeset, :page, :draft, _workspace_id, _doc_id),
    do: add_error(changeset, :workspace_id, "draft pages require workspace_id only")

  defp validate_article_ref(changeset, :page, :public, _workspace_id, _doc_id),
    do: add_error(changeset, :doc_id, "public pages require doc_id only")

  defp validate_article_ref(changeset, type, _stage, workspace_id, doc_id)
       when type in [:group, :link, :pin] do
    if is_nil(workspace_id) and is_nil(doc_id) do
      changeset
    else
      add_error(changeset, :workspace_id, "#{type} nodes can not reference articles")
    end
  end

  defp validate_article_ref(changeset, _type, _stage, _workspace_id, _doc_id),
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

  defp validate_link_href(changeset, type, href) when type in [:group, :page] do
    if is_nil(href) or (is_binary(href) and String.trim(href) == "") do
      changeset
    else
      add_error(changeset, :href, "#{type} nodes can not have href")
    end
  end
end
