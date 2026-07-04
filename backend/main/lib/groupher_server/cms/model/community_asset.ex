defmodule GroupherServer.CMS.Model.CommunityAsset do
  @moduledoc """
  Community-level asset catalog entry.

  This table is the billing and library source of truth. An asset counts toward
  community storage as soon as it exists here, regardless of whether any article
  currently references it.

      account.users
           |
           v
      community_assets  <----  communities
           |
           v
      article_document_asset_refs  --->  article_documents

  `article_document_asset_refs` describes usage. `community_assets` describes
  ownership, storage, and bytes.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias CMS.Hash
  alias CMS.Model.{ArticleDocumentAssetRef, Community}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @asset_types ~w(image video audio file)a
  @statuses ~w(active deleted)a

  @required_fields ~w(community_id url size_bytes)a
  @optional_fields ~w(
    uploader_id asset_type status title filename mime_type url_hash storage storage_key
    content_hash width height meta deleted_at
  )a

  @type asset_type :: :image | :video | :audio | :file
  @type status :: :active | :deleted
  @type t :: %CommunityAsset{}

  schema "community_assets" do
    belongs_to(:community, Community)
    belongs_to(:uploader, User, foreign_key: :uploader_id)

    field(:asset_type, Ecto.Enum, values: @asset_types, default: :file)
    field(:status, Ecto.Enum, values: @statuses, default: :active)

    field(:title, :string)
    field(:filename, :string)
    field(:mime_type, :string)

    field(:url, :string)
    field(:url_hash, :string)
    field(:storage, :string)
    field(:storage_key, :string)
    field(:content_hash, :string)

    field(:size_bytes, :integer, default: 0)
    field(:width, :integer)
    field(:height, :integer)
    field(:meta, :map, default: %{})
    field(:deleted_at, :utc_datetime)

    has_many(:article_refs, ArticleDocumentAssetRef, foreign_key: :asset_id)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%CommunityAsset{} = asset, attrs) do
    asset
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> put_url_hash()
    |> validate_required(@required_fields ++ [:url_hash])
    |> validate_number(:size_bytes, greater_than_or_equal_to: 0)
    |> validate_number(:width, greater_than: 0)
    |> validate_number(:height, greater_than: 0)
    |> validate_length(:url, min: 1)
    |> validate_length(:title, max: 160)
    |> validate_length(:filename, max: 255)
    |> validate_length(:mime_type, max: 120)
    |> validate_length(:storage, max: 80)
    |> validate_length(:storage_key, max: 500)
    |> validate_length(:content_hash, max: 160)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:uploader_id)
    |> unique_constraint([:community_id, :url_hash],
      name: :community_assets_community_url_hash_index
    )
    |> unique_constraint([:community_id, :storage, :storage_key],
      name: :community_assets_community_storage_key_index
    )
  end

  @doc false
  def update_changeset(%CommunityAsset{} = asset, attrs), do: changeset(asset, attrs)

  def asset_types, do: @asset_types
  def statuses, do: @statuses

  defp put_url_hash(changeset) do
    case get_field(changeset, :url) do
      url when is_binary(url) -> put_change(changeset, :url_hash, Hash.asset_url_hash(url))
      _ -> changeset
    end
  end
end
