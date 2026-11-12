defmodule GroupherServer.CMS.Model.ArticleAssetRef do
  @moduledoc """
  Asset membership owned by one WorkingCopy or immutable Snapshot.

      WorkingCopy / Snapshot -> ArticleAssetRef -> CommunityAsset

  Exactly one owner is required. Snapshot refs retain historical asset membership.
  """

  use Ecto.Schema
  use Flop.Schema

  @flop_options [filterable: [], sortable: [:id, :inserted_at], pagination_types: [:page, :first]]

  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Model.{
    ArticleSnapshot,
    ArticleWorkingCopy,
    Community,
    CommunityAsset
  }

  alias CMS.Assets.ThreadIdentity

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @usage_values ~w(inline cover cover_dark attachment embed)a
  @required_fields ~w(community_id asset_id usage)a
  @optional_fields ~w(working_copy_id snapshot_id block_id block_type
                      position title alt source meta)a

  @type usage :: :inline | :cover | :cover_dark | :attachment | :embed
  @type t :: %__MODULE__{}

  schema "article_asset_refs" do
    belongs_to(:community, Community)
    belongs_to(:asset, CommunityAsset)
    belongs_to(:working_copy, ArticleWorkingCopy, type: Ecto.UUID)
    belongs_to(:snapshot, ArticleSnapshot, type: Ecto.UUID)
    field(:article_id, Ecto.UUID, virtual: true)
    field(:thread, Ecto.Enum, values: ThreadIdentity.values(), virtual: true)
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
    |> foreign_key_constraint(:working_copy_id)
    |> foreign_key_constraint(:snapshot_id)
    |> validate_owner()
    |> check_constraint(:working_copy_id, name: :article_asset_refs_exactly_one_owner)
    |> unique_constraint([:working_copy_id, :usage],
      name: :article_asset_refs_working_copy_cover_index
    )
    |> unique_constraint([:snapshot_id, :usage], name: :article_asset_refs_snapshot_cover_index)
  end

  defp validate_owner(changeset) do
    owners =
      Enum.count(
        ~w(working_copy_id snapshot_id)a,
        &(not is_nil(Ecto.Changeset.get_field(changeset, &1)))
      )

    if owners == 1 do
      changeset
    else
      Ecto.Changeset.add_error(changeset, :working_copy_id, "must have exactly one content owner")
    end
  end

  @doc "Returns every supported asset usage."
  @spec usage_values() :: [usage()]
  def usage_values, do: @usage_values
end
