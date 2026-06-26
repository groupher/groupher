defmodule GroupherServer.CMS.Model.DocTreeNodeDraft do
  @moduledoc """
  Dashboard working copy for docs navigation nodes.

  `doc_tree_nodes` is reserved for published navigation. This draft table is
  what the dashboard editor mutates.

      group: parent_id=nil, no article_draft_id
      page:  parent_id=group.id, article_draft_id points to ArticleDraft
      link:  parent_id=group.id, href stores external/internal URL
      pin:   parent_id=nil, target_node_id points at the original page/link

  The public GraphQL shape exposes `docId`; while reading draft data that value
  maps to `article_draft_id`.
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Marker
  alias CMS.Model.{ArticleDraft, Community}
  alias Helper.Constant.DBPrefix
  alias Helper.Validator.Slug

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @node_types [:group, :page, :link, :pin]
  @required_fields ~w(community_id type index)a
  @optional_fields ~w(parent_id article_draft_id target_node_id title slug href marker badge hidden template_key ui_config deleted_at)a

  @type t :: %DocTreeNodeDraft{}
  schema "doc_tree_node_drafts" do
    belongs_to(:community, Community)
    belongs_to(:parent, DocTreeNodeDraft)
    belongs_to(:article_draft, ArticleDraft)
    belongs_to(:target_node, DocTreeNodeDraft)

    field(:type, Ecto.Enum, values: @node_types)
    field(:title, :string)
    field(:slug, :string)
    field(:index, :integer, default: 0)
    field(:href, :string)
    field(:marker, :map)
    field(:badge, :string)
    field(:hidden, :boolean, default: false)
    field(:template_key, :string)
    field(:ui_config, :map, default: %{})
    field(:deleted_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  def node_types, do: @node_types

  def changeset(%DocTreeNodeDraft{} = node, attrs) do
    node
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> Marker.normalize_changeset(:marker)
    |> validate_required(@required_fields)
    |> validate_length(:title, min: 1, max: 100)
    |> validate_length(:slug, min: 1, max: 120)
    |> validate_length(:href, max: 400)
    |> Slug.validate_changeset(:slug)
    |> validate_node_shape()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:parent_id)
    |> foreign_key_constraint(:article_draft_id)
    |> foreign_key_constraint(:target_node_id)
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
    |> Marker.normalize_changeset(:marker)
    |> validate_length(:title, min: 1, max: 100)
    |> validate_length(:slug, min: 1, max: 120)
    |> validate_length(:href, max: 400)
    |> Slug.validate_changeset(:slug)
    |> validate_node_shape()
    |> foreign_key_constraint(:parent_id)
    |> foreign_key_constraint(:article_draft_id)
    |> foreign_key_constraint(:target_node_id)
    |> unique_constraint(:template_key,
      name: :doc_tree_node_drafts_community_id_template_key_index
    )
    |> unique_constraint(:slug, name: :doc_tree_node_drafts_root_slug_index)
    |> unique_constraint(:title, name: :doc_tree_node_drafts_root_title_index)
    |> unique_constraint(:slug, name: :doc_tree_node_drafts_sibling_slug_index)
    |> unique_constraint(:title, name: :doc_tree_node_drafts_sibling_title_index)
  end

  defp validate_node_shape(changeset) do
    type = get_field(changeset, :type)
    parent_id = get_field(changeset, :parent_id)
    article_draft_id = get_field(changeset, :article_draft_id)
    target_node_id = get_field(changeset, :target_node_id)
    href = get_field(changeset, :href)

    changeset
    |> validate_title_slug_ref(type)
    |> validate_group_parent(type, parent_id)
    |> validate_article_draft_ref(type, article_draft_id)
    |> validate_target_ref(type, target_node_id)
    |> validate_link_href(type, href)
  end

  defp validate_title_slug_ref(changeset, :pin), do: changeset

  defp validate_title_slug_ref(changeset, type) when type in [:group, :page, :link] do
    changeset
    |> validate_required([:title, :slug])
  end

  defp validate_group_parent(changeset, :group, nil), do: changeset
  defp validate_group_parent(changeset, :pin, nil), do: changeset

  defp validate_group_parent(changeset, :group, _parent_id) do
    add_error(changeset, :parent_id, "group nodes must be root nodes")
  end

  defp validate_group_parent(changeset, :pin, _parent_id) do
    add_error(changeset, :parent_id, "pin nodes must be root nodes")
  end

  defp validate_group_parent(changeset, type, nil) when type in [:page, :link] do
    add_error(changeset, :parent_id, "#{type} nodes must belong to a group")
  end

  defp validate_group_parent(changeset, _type, _parent_id), do: changeset

  defp validate_article_draft_ref(changeset, :page, nil) do
    add_error(changeset, :article_draft_id, "page nodes require article_draft_id")
  end

  defp validate_article_draft_ref(changeset, :page, _article_draft_id), do: changeset

  defp validate_article_draft_ref(changeset, type, article_draft_id)
       when type in [:group, :link, :pin] do
    if is_nil(article_draft_id) do
      changeset
    else
      add_error(changeset, :article_draft_id, "#{type} nodes can not reference article drafts")
    end
  end

  defp validate_target_ref(changeset, :pin, nil) do
    add_error(changeset, :target_node_id, "pin nodes require target_node_id")
  end

  defp validate_target_ref(changeset, :pin, _target_node_id), do: changeset

  defp validate_target_ref(changeset, type, target_node_id)
       when type in [:group, :page, :link] do
    if is_nil(target_node_id) do
      changeset
    else
      add_error(changeset, :target_node_id, "#{type} nodes can not reference target nodes")
    end
  end

  defp validate_link_href(changeset, :link, href) when is_binary(href) do
    if String.trim(href) == "" do
      add_error(changeset, :href, "link nodes require href")
    else
      changeset
    end
  end

  defp validate_link_href(changeset, :link, _href),
    do: add_error(changeset, :href, "link nodes require href")

  defp validate_link_href(changeset, type, href) when type in [:group, :page, :pin] do
    if is_nil(href) or (is_binary(href) and String.trim(href) == "") do
      changeset
    else
      add_error(changeset, :href, "#{type} nodes can not have href")
    end
  end
end
