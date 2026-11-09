defmodule GroupherServer.CMS.ProductionSeed.LoginGrant do
  @moduledoc "Hashed, single-use acceptance credential; plaintext is never persisted. Operator issue -> hashed grant -> Auth redemption."
  use Ecto.Schema

  schema "production_seed_logins" do
    field(:run_id, :integer)
    field(:user_id, :integer)
    field(:digest, :binary)
    field(:expires_at, :utc_datetime)
    field(:consumed_at, :utc_datetime)
    field(:session_ref, :string)
    timestamps(type: :utc_datetime)
  end
end
