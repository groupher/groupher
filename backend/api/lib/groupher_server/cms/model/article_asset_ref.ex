defmodule GroupherServer.CMS.Model.ArticleAssetRef do
  @moduledoc """
  Asset membership owned by either a mutable body Draft or immutable Revision.

      ArticleBodyDraft --\
                          -> ArticleAssetRef -> CommunityAsset
      ArticleRevision ---/

  Exactly one owner is required. Draft discard and Revision cleanup therefore
  release only the refs owned by that content version.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{
    ArticleBodyDraft,
    ArticleRevision,
    Community,
    CommunityAsset
  }

  alias GroupherServer.CMS.Artiment.Threads

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @usage_values ~w(inline cover cover_dark attachment embed)a
  @required_fields ~w(community_id asset_id usage)a
  @optional_fields ~w(body_draft_id revision_id block_id block_type position title alt source meta)a

  @type usage :: :inline | :cover | :cover_dark | :attachment | :embed
  @type t :: %__MODULE__{}

  schema "article_asset_refs" do
    belongs_to(:community, Community)
    belongs_to(:asset, CommunityAsset)
    belongs_to(:body_draft, ArticleBodyDraft, type: Ecto.UUID)
    belongs_to(:revision, ArticleRevision, type: Ecto.UUID)
    field(:article_id, Ecto.UUID, virtual: true)
    field(:thread, Ecto.Enum, values: Threads.article_enums(), virtual: true)
    field(:usage, Ecto.Enum, values: @usage_values, default: :inline)
    field(:block_id, :string)
    field(:block_type, :string)
    field(:position, :integer)
    field(:title, :string)
    field(:alt, :string)
    field(:source, :string)
    field(:meta, :map, default: %{})
    timestamps(type: :utc_datetime)
  end

  @doc "Builds a version-owned asset reference changeset."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = ref, attrs) do
    ref
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:position, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:asset_id)
    |> foreign_key_constraint(:body_draft_id)
    |> foreign_key_constraint(:revision_id)
    |> check_constraint(:body_draft_id, name: :article_asset_refs_exactly_one_owner)
    |> unique_constraint([:body_draft_id, :usage], name: :article_asset_refs_draft_cover_index)
    |> unique_constraint([:revision_id, :usage], name: :article_asset_refs_revision_cover_index)
  end

  @doc "Returns every supported asset usage."
  @spec usage_values() :: [usage()]
  def usage_values, do: @usage_values
end
