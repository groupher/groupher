defmodule GroupherServer.PublicCache.Model.Invalidation do
  @moduledoc """
  Durable public-cache invalidation record.

  The row is created in the same transaction as the domain change. It contains
  a typed domain change and a stable delivery id; Cloudflare is contacted only
  by the Oban worker after commit.

  Business position:

      domain transaction -> Invalidation row -> Oban delivery worker
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.PublicCache
  alias PublicCache.Const
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @primary_key {:id, :binary_id, autogenerate: false}

  schema "public_cache_invalidations" do
    field(:contract_version, :integer, default: 1)
    field(:type, Ecto.Enum, values: Const.invalidation_types())
    field(:aggregate_type, :string)
    field(:aggregate_id, :string)
    field(:community_id, :id)
    field(:payload, :map, default: %{})
    field(:causation_id, Ecto.UUID)
    field(:status, Ecto.Enum, values: Const.statuses(), default: :pending)
    field(:attempts, :integer, default: 0)
    field(:available_at, :utc_datetime)
    field(:locked_at, :utc_datetime)
    field(:locked_by, :string)
    field(:delivered_at, :utc_datetime)
    field(:last_error_code, :string)
    field(:last_error_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(invalidation, attrs) do
    invalidation
    |> cast(attrs, [
      :id,
      :contract_version,
      :type,
      :aggregate_type,
      :aggregate_id,
      :community_id,
      :payload,
      :causation_id,
      :status,
      :attempts,
      :available_at,
      :locked_at,
      :locked_by,
      :delivered_at,
      :last_error_code,
      :last_error_at
    ])
    |> validate_required([
      :id,
      :contract_version,
      :type,
      :aggregate_type,
      :aggregate_id,
      :payload,
      :causation_id,
      :status,
      :attempts,
      :available_at
    ])
    |> validate_number(:contract_version, equal_to: 1)
    |> validate_number(:attempts, greater_than_or_equal_to: 0)
    |> unique_constraint(:id, name: :public_cache_invalidations_pkey)
    |> unique_constraint(:causation_id,
      name: :public_cache_invalidations_causation_type_aggregate_index
    )
  end
end
