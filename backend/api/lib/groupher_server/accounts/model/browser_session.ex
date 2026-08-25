defmodule GroupherServer.Accounts.Model.BrowserSession do
  @moduledoc """
  Persisted browser login continuity record owned by Accounts.

  `ref` is the opaque internal link carried by Auth.js and browser access-token
  claims. `public_ref` is a separate opaque handle for user device management.

  Business position:

      Accounts context
        -> BrowserSession schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.account()
  @required_fields ~w(ref public_ref user_id status absolute_expires_at)a
  @optional_fields ~w(
    last_refreshed_at last_seen_at revoked_at revoked_reason
    browser_family os_family device_family user_agent_summary
    created_country created_region created_city
    last_seen_country last_seen_region last_seen_city
  )a

  @type t :: %__MODULE__{}

  schema "browser_sessions" do
    field(:ref, :string)
    field(:public_ref, :string)
    field(:status, Ecto.Enum, values: [:active, :revoked], default: :active)
    field(:absolute_expires_at, :utc_datetime)
    field(:last_refreshed_at, :utc_datetime)
    field(:last_seen_at, :utc_datetime)
    field(:revoked_at, :utc_datetime)
    field(:revoked_reason, :string)

    field(:browser_family, :string)
    field(:os_family, :string)
    field(:device_family, :string)
    field(:user_agent_summary, :string)
    field(:created_country, :string)
    field(:created_region, :string)
    field(:created_city, :string)
    field(:last_seen_country, :string)
    field(:last_seen_region, :string)
    field(:last_seen_city, :string)

    belongs_to(:user, User)

    timestamps(type: :utc_datetime)
  end

  def changeset(session, attrs) do
    session
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_length(:ref, min: 8, max: 256)
    |> validate_length(:public_ref, min: 8, max: 256)
    |> unique_constraint(:ref)
    |> unique_constraint(:public_ref)
    |> foreign_key_constraint(:user_id)
  end
end
