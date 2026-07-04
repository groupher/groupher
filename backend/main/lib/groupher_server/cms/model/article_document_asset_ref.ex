defmodule GroupherServer.CMS.Model.ArticleDocumentAssetRef do
  @moduledoc """
  Block-level article document to asset usage projection.

  This table is intentionally separate from `community_assets`:

      article_documents
             |
             v
      article_document_asset_refs  --->  community_assets

  `community_assets` owns bytes and billing. Refs answer product questions such
  as "where is this image used?", "which cover asset belongs to this article?",
  and "which resources are currently orphaned?".
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Artiment.Threads
  alias CMS.Model.{ArticleDocument, Community, CommunityAsset}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @usage_values ~w(inline cover cover_dark attachment embed)a

  @required_fields ~w(community_id article_document_id asset_id thread article_id usage)a
  @optional_fields ~w(block_id block_type position title alt source meta)a

  @type usage :: :inline | :cover | :cover_dark | :attachment | :embed
  @type t :: %ArticleDocumentAssetRef{}

  schema "article_document_asset_refs" do
    belongs_to(:community, Community)
    belongs_to(:article_document, ArticleDocument)
    belongs_to(:asset, CommunityAsset)

    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:article_id, :id)
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

  @doc false
  def changeset(%ArticleDocumentAssetRef{} = ref, attrs) do
    ref
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> validate_number(:position, greater_than_or_equal_to: 0)
    |> validate_length(:block_id, max: 120)
    |> validate_length(:block_type, max: 80)
    |> validate_length(:title, max: 160)
    |> validate_length(:alt, max: 255)
    |> validate_length(:source, max: 80)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:article_document_id)
    |> foreign_key_constraint(:asset_id)
    |> unique_constraint([:article_document_id, :usage],
      name: :article_document_asset_refs_cover_usage_index
    )
    |> unique_constraint([:article_document_id, :asset_id, :usage, :block_id],
      name: :article_document_asset_refs_block_index
    )
  end

  @doc false
  def update_changeset(%ArticleDocumentAssetRef{} = ref, attrs), do: changeset(ref, attrs)

  def usage_values, do: @usage_values
end
