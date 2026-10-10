defmodule GroupherServer.CMS.Model.AssetReplacementPlan do
  @moduledoc """
  Immutable snapshot of a cross-Article asset replacement proposal.

  `items` records observed Draft versions, live Revision heads and stable
  locators. Applying a plan only writes Draft commands; it never updates
  Revision-owned references in place.

  Business position:

      replacement planning
        -> AssetReplacementPlan snapshot
        -> observed item state -> revalidated Draft command
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Community, CommunityAsset}
  alias GroupherServer.Accounts.Model.User
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  schema "asset_replacement_plans" do
    belongs_to(:community, Community)
    belongs_to(:from_asset, CommunityAsset)
    belongs_to(:to_asset, CommunityAsset)
    belongs_to(:created_by, User)
    field(:status, Ecto.Enum, values: [:pending, :partially_applied, :completed, :cancelled])
    field(:apply_run_ref, :string)
    field(:items, {:array, :map}, default: [])
    field(:applied_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds a replacement plan changeset. Plan items are write-once snapshots."
  def changeset(plan, attrs) do
    plan
    |> cast(attrs, [
      :community_id,
      :from_asset_id,
      :to_asset_id,
      :created_by_id,
      :status,
      :apply_run_ref,
      :items,
      :applied_at
    ])
    |> validate_required([
      :community_id,
      :from_asset_id,
      :to_asset_id,
      :created_by_id,
      :status,
      :items
    ])
    |> validate_inclusion(:status, [:pending, :partially_applied, :completed, :cancelled])
    |> validate_length(:items, max: 10_000)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:from_asset_id)
    |> foreign_key_constraint(:to_asset_id)
    |> foreign_key_constraint(:created_by_id)
  end
end
