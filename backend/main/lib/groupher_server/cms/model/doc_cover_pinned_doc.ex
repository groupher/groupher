defmodule GroupherServer.CMS.Model.DocCoverPinnedDoc do
  @moduledoc """
  One top-level pinned docs cover card backed by a published page node.

  Pinned docs are independent from cover groups. Each relation owns its Light
  and Dark card appearance without changing the document's tree membership.

  Business position:

      CMS context
        -> DocCoverPinnedDoc schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Community, DocTreeNode}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @default_appearance %{"light" => %{}, "dark" => %{}}

  @required_fields ~w(community_id node_id index)a
  @optional_fields ~w(appearance)a

  @type t :: %DocCoverPinnedDoc{}
  schema "doc_cover_pinned_docs" do
    belongs_to(:community, Community)
    belongs_to(:node, DocTreeNode)

    field(:index, :integer, default: 0)
    field(:appearance, :map, default: @default_appearance)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%DocCoverPinnedDoc{} = doc, attrs) do
    doc
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:index, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:node_id)
    |> unique_constraint(:node_id, name: :doc_cover_pinned_docs_community_node_index)
  end

  @doc false
  def update_changeset(%DocCoverPinnedDoc{} = doc, attrs), do: changeset(doc, attrs)
end
