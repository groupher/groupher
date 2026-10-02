defmodule GroupherServer.CMS.Model.AssetUsageCompleteness do
  @moduledoc """
  Durable receipt for one Community's asset-usage backfill scope.

  Business position:

      asset backfill
        -> AssetUsageCompleteness row
        -> pending or completed receipt -> GC/deletion guard
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()

  schema "asset_usage_completeness" do
    belongs_to(:community, GroupherServer.CMS.Model.Community, primary_key: true)
    field(:schema_version, :integer, default: 1)
    field(:status, Ecto.Enum, values: [:pending, :completed], default: :pending)
    field(:scope, :string, default: "community")
    field(:receipt_id, Ecto.UUID)
    field(:completed_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(record, attrs) do
    record
    |> cast(attrs, [:community_id, :schema_version, :status, :scope, :receipt_id, :completed_at])
    |> validate_required([:community_id, :schema_version, :status, :scope])
    |> validate_number(:schema_version, greater_than: 0)
  end
end
