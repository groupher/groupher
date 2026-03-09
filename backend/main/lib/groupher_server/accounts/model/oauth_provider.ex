defmodule GroupherServer.Accounts.Model.OauthProvider do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.account()
  @required_fields ~w(provider_id provider login nickname avatar user_id)a
  @optional_fields ~w(email locale country city company bio raw)a

  @type t :: %OauthProvider{}
  schema "oauth_providers" do
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
  end

  @doc false
  def changeset(%OauthProvider{} = oauth_provider, attrs) do
    oauth_provider
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:user_id)

    # |> unique_constraint(:user_id, name: :users_login_index)
  end
end
