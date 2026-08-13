defmodule GroupherServer.Accounts.Model.OauthProvider do
  @moduledoc """
  Ecto schema for external OAuth identities linked to a user.

  Each row binds one provider/provider-id pair to one account. Provider profile
  fields are bounded display metadata; provider credentials are never persisted.

  Business position:

      Accounts context
        -> OauthProvider schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias __MODULE__

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.account()
  @required_fields ~w(provider_id provider user_id)a
  @optional_fields ~w(login nickname avatar email locale link country city company bio public_ref)a

  @type t :: %OauthProvider{}
  schema "oauth_providers" do
    field(:public_ref, :string)
    field(:provider, :string)
    field(:provider_id, :string)
    field(:login, :string)
    field(:nickname, :string)
    field(:avatar, :string)
    field(:email, :string)
    field(:locale, :string)
    field(:link, :string)
    field(:bio, :string)
    field(:country, :string)
    field(:city, :string)
    field(:company, :string)
    field(:raw, :map)

    belongs_to(:user, User, foreign_key: :user_id)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%OauthProvider{} = oauth_provider, attrs) do
    oauth_provider
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:public_ref, name: :oauth_providers_public_ref_index)
    |> unique_constraint(:provider_id, name: :oauth_providers_provider_provider_id_index)
    |> unique_constraint(:user_id, name: :oauth_providers_user_id_provider_index)
  end
end
