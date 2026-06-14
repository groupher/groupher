defmodule GroupherServer.CMS.Model.DocTreeNodeDraft do
  @moduledoc """
  Dashboard working copy for docs navigation nodes.

  `doc_tree_nodes` is reserved for published navigation. This draft table is
  what the dashboard editor mutates.

      group: parent_id=nil, no doc_draft_id
      page:  parent_id=group.id, doc_draft_id points to DocDraft
      link:  parent_id=group.id, href stores external/internal URL

  The public GraphQL shape exposes `docId`; while reading draft data that value
  maps to `doc_draft_id`.
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.{Community, DocDraft}
  alias Helper.Constant.DBPrefix
  alias Helper.Validator.Slug

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @node_types [:group, :page, :link]
  @required_fields ~w(community_id type title slug index)a
  @optional_fields ~w(parent_id doc_draft_id href icon badge hidden expanded template_key)a

  @type t :: %DocTreeNodeDraft{}
  schema "doc_tree_node_drafts" do
    belongs_to(:community, Community)
    belongs_to(:parent, DocTreeNodeDraft)
    belongs_to(:doc_draft, DocDraft)

    field(:type, Ecto.Enum, values: @node_types)
    field(:title, :string)
    field(:slug, :string)
    field(:index, :integer, default: 0)
    field(:href, :string)
    field(:icon, :map)
    field(:badge, :string)
    field(:hidden, :boolean, default: false)
    field(:expanded, :boolean, default: true)
    field(:template_key, :string)

    timestamps(type: :utc_datetime)
  end

  def node_types, do: @node_types

  def changeset(%DocTreeNodeDraft{} = node, attrs) do
    node
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> normalize_slug()
    |> validate_required(@required_fields)
    |> validate_length(:title, min: 1, max: 100)
    |> validate_length(:slug, min: 1, max: 120)
    |> validate_length(:href, max: 400)
    |> Slug.validate_changeset(:slug)
    |> validate_node_shape()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:parent_id)
    |> foreign_key_constraint(:doc_draft_id)
    |> unique_constraint(:template_key,
      name: :doc_tree_node_drafts_community_id_template_key_index
    )
    |> unique_constraint(:slug, name: :doc_tree_node_drafts_root_slug_index)
    |> unique_constraint(:title, name: :doc_tree_node_drafts_root_title_index)
    |> unique_constraint(:slug, name: :doc_tree_node_drafts_sibling_slug_index)
    |> unique_constraint(:title, name: :doc_tree_node_drafts_sibling_title_index)
  end

  def update_changeset(%DocTreeNodeDraft{} = node, attrs) do
    node
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> normalize_slug()
    |> validate_length(:title, min: 1, max: 100)
    |> validate_length(:slug, min: 1, max: 120)
    |> validate_length(:href, max: 400)
    |> Slug.validate_changeset(:slug)
    |> validate_node_shape()
    |> foreign_key_constraint(:parent_id)
    |> foreign_key_constraint(:doc_draft_id)
    |> unique_constraint(:template_key,
      name: :doc_tree_node_drafts_community_id_template_key_index
    )
    |> unique_constraint(:slug, name: :doc_tree_node_drafts_root_slug_index)
    |> unique_constraint(:title, name: :doc_tree_node_drafts_root_title_index)
    |> unique_constraint(:slug, name: :doc_tree_node_drafts_sibling_slug_index)
    |> unique_constraint(:title, name: :doc_tree_node_drafts_sibling_title_index)
  end

  defp normalize_slug(changeset) do
    case get_change(changeset, :slug) do
      slug when is_binary(slug) -> put_change(changeset, :slug, Slug.normalize(slug))
      _ -> changeset
    end
  end

  defp validate_node_shape(changeset) do
    type = get_field(changeset, :type)
    parent_id = get_field(changeset, :parent_id)
    href = get_field(changeset, :href)

    changeset
    |> validate_group_parent(type, parent_id)
    |> validate_link_href(type, href)
  end

  defp validate_group_parent(changeset, :group, nil), do: changeset

  defp validate_group_parent(changeset, :group, _parent_id) do
    add_error(changeset, :parent_id, "group nodes must be root nodes")
  end

  defp validate_group_parent(changeset, type, nil) when type in [:page, :link] do
    add_error(changeset, :parent_id, "#{type} nodes must belong to a group")
  end

  defp validate_group_parent(changeset, _type, _parent_id), do: changeset

  defp validate_link_href(changeset, :link, href) when is_binary(href) do
    if String.trim(href) == "" do
      add_error(changeset, :href, "link nodes require href")
    else
      changeset
    end
  end

  defp validate_link_href(changeset, :link, _href),
    do: add_error(changeset, :href, "link nodes require href")

  defp validate_link_href(changeset, _type, _href), do: changeset
end
