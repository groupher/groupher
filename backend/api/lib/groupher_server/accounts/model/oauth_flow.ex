defmodule GroupherServer.Accounts.Model.OauthFlow do
  @moduledoc """
  Short-lived OAuth state stored in Accounts.

      Auth request -> Accounts flow -> PostgreSQL
  """

  use Ecto.Schema
  import Ecto.Changeset

  @schema_prefix "account"

  schema "oauth_flows" do
    field(:ref, :string)
    field(:purpose, :string)
    field(:status, :string)
    field(:provider, :string)
    field(:identity, :map, redact: true)
    field(:browser_session_ref, :string, redact: true)
    field(:code_verifier, :string, redact: true)
    field(:nonce, :string, redact: true)
    field(:return_to, :string)
    field(:expires_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  def changeset(flow, attrs) do
    flow
    |> cast(attrs, [
      :ref,
      :purpose,
      :status,
      :provider,
      :identity,
      :browser_session_ref,
      :code_verifier,
      :nonce,
      :return_to,
      :expires_at
    ])
    |> validate_required([:ref, :purpose, :status, :provider, :expires_at])
    |> validate_inclusion(:purpose, ["registration", "link"])
    |> unique_constraint(:ref)
  end
end
