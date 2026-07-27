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
  import Ecto.Query, warn: false

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
    public_ref content_hash width height meta deleted_at
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
    field(:public_ref, :string)
    field(:content_hash, :string)

    field(:size_bytes, :integer, default: 0)
    field(:width, :integer)
    field(:height, :integer)
    field(:meta, :map, default: %{})
    field(:deleted_at, :utc_datetime)

    has_many(:article_refs, ArticleDocumentAssetRef, foreign_key: :asset_id)

    timestamps(type: :utc_datetime)
  end

  @doc """
  Builds a changeset for creating or updating a community asset.

  The changeset computes `url_hash`, validates storage metadata, and attaches
  the DB constraints used by the asset deduplication flow.

  ## Examples

      CommunityAsset.changeset(%CommunityAsset{}, %{
        community_id: community.id,
        url: "https://cdn.example/hero.png",
        size_bytes: 2048
      })
      #=> %Ecto.Changeset{valid?: true}

  """
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
    |> validate_length(:public_ref, max: 80)
    |> validate_length(:content_hash, max: 160)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:uploader_id)
    |> unique_constraint([:community_id, :url_hash],
      name: :community_assets_community_url_hash_index
    )
    |> unique_constraint([:community_id, :storage, :storage_key],
      name: :community_assets_community_storage_key_index
    )
    |> unique_constraint(:public_ref, name: :community_assets_public_ref_index)
  end

  @doc """
  Builds an update changeset for an existing community asset.

  It intentionally reuses `changeset/2` so create/update paths share the same
  URL hash calculation and validation rules.

  ## Examples

      CommunityAsset.update_changeset(asset, %{title: "Updated title"})
      #=> %Ecto.Changeset{}

  """
  def update_changeset(%CommunityAsset{} = asset, attrs), do: changeset(asset, attrs)

  @doc """
  Builds the base query for active assets in a community.

  Active assets are rows that still belong to the community catalog and count
  toward storage usage. Soft-deleted rows are excluded.

  ## Examples

      CommunityAsset.active_query(community.id)
      #=> #Ecto.Query<from a0 in CommunityAsset, ...>

  """
  def active_query(community_id) do
    __MODULE__
    |> where([asset], asset.community_id == ^community_id)
    |> where([asset], is_nil(asset.deleted_at))
    |> where([asset], asset.status == :active)
  end

  @doc """
  Builds the active-asset query for one asset inside a community.

  Use this when callers need the shared active predicate plus an asset identity
  filter. Callers can add ordering, locking, selecting, or pagination on top.

  ## Examples

      CommunityAsset.active_query(community.id, asset.id)
      #=> #Ecto.Query<from a0 in CommunityAsset, ...>

  """
  def active_query(community_id, asset_id) do
    community_id
    |> active_query()
    |> where([asset], asset.id == ^asset_id)
  end

  @doc """
  Returns the supported community asset type values.

  ## Examples

      CommunityAsset.asset_types()
      #=> [:image, :video, :audio, :file]

  """
  def asset_types, do: @asset_types

  @doc """
  Returns the supported lifecycle status values.

  ## Examples

      CommunityAsset.statuses()
      #=> [:active, :deleted]

  """
  def statuses, do: @statuses

  defp put_url_hash(changeset) do
    case get_field(changeset, :url) do
      url when is_binary(url) -> put_change(changeset, :url_hash, Hash.asset_url_hash(url))
      _ -> changeset
    end
  end
end
