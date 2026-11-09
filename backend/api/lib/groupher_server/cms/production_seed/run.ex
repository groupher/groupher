defmodule GroupherServer.CMS.ProductionSeed.Run do
  @moduledoc """
  Persistent ownership ledger for one bounded production acceptance window.
  `run_id` is the external string key; the row's integer `id` is referenced by
  `LoginGrant.run_id`.

      Operator -> run ledger -> owned fixture manifest
  """
  use Ecto.Schema

  schema "production_seed_runs" do
    field(:run_id, :string)
    field(:status, :string, default: "active")
    field(:database_name, :string)
    field(:expires_at, :utc_datetime)
    field(:manifest, :map, default: %{})
    timestamps(type: :utc_datetime)
  end
end
