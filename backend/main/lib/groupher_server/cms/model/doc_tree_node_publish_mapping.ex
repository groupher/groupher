defmodule GroupherServer.CMS.Model.DocTreeNodePublishMapping do
  @moduledoc """
  Mapping between dashboard draft tree nodes and published tree nodes.

      doc_tree_node_drafts.id  --publish-->  doc_tree_nodes.id
              |                                |
              +-- article_draft_id            +-- doc_id

  Cover rows only reference published nodes. Dashboard editor rows use this
  mapping to know whether a draft node is currently public and can be added to
  the public cover.

      visibility: :public
          draft node is visible through the published tree

      visibility: :draft
          published pair is kept for future re-publish, but hidden from public
          docs and cover reads
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{ArticleDraft, Community, Doc, DocTreeNode, DocTreeNodeDraft}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @visibility_values [:draft, :public]
  @required_fields ~w(community_id draft_node_id published_node_id)a
  @optional_fields ~w(draft_doc_id published_doc_id draft_node_updated_at draft_doc_content_hash visibility last_published_at last_moved_to_draft_at)a

  @type t :: %DocTreeNodePublishMapping{}
  def visibility_values, do: @visibility_values

  schema "doc_tree_node_publish_mappings" do
    belongs_to(:community, Community)
    belongs_to(:draft_node, DocTreeNodeDraft)
    belongs_to(:published_node, DocTreeNode)
    belongs_to(:draft_doc, ArticleDraft)
    belongs_to(:published_doc, Doc)

    field(:draft_node_updated_at, :utc_datetime)
    field(:draft_doc_content_hash, :string)
    field(:visibility, Ecto.Enum, values: @visibility_values, default: :public)
    field(:last_published_at, :utc_datetime)
    field(:last_moved_to_draft_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%DocTreeNodePublishMapping{} = mapping, attrs) do
    mapping
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:draft_node_id)
    |> foreign_key_constraint(:published_node_id)
    |> foreign_key_constraint(:draft_doc_id)
    |> foreign_key_constraint(:published_doc_id)
    |> unique_constraint(:draft_node_id, name: :doc_tree_node_publish_mappings_draft_index)
    |> unique_constraint(:published_node_id,
      name: :doc_tree_node_publish_mappings_published_index
    )
  end

  @doc false
  def update_changeset(%DocTreeNodePublishMapping{} = mapping, attrs),
    do: changeset(mapping, attrs)
end
