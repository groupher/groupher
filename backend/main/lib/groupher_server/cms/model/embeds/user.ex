defmodule GroupherServer.CMS.Model.Embeds.User do
  @type t :: %__MODULE__{}

  @moduledoc """
  only used for embeds_many situation
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User, as: AccountUser

  @primary_key {:id, :integer, autogenerate: false}

  embedded_schema do
    field(:user_id, :integer)
    field(:login, :string)
    field(:avatar, :string)
    field(:nickname, :string)
  end

  @doc """
  Builds embed user data from an account user.
  """
  @spec from_account_user(AccountUser.t()) :: t()
  def from_account_user(%AccountUser{} = user) do
    %__MODULE__{
      id: user.id,
      user_id: user.id,
      login: user.login,
      avatar: user.avatar,
      nickname: user.nickname || user.login
    }
  end

  @doc """
  Normalizes map/struct values into an embed user struct.
  """
  @spec normalize(term()) :: t()
  def normalize(%AccountUser{} = user), do: from_account_user(user)

  def normalize(%__MODULE__{} = user) do
    %__MODULE__{
      id: user.id || user.user_id,
      user_id: user.user_id || user.id,
      login: user.login,
      avatar: user.avatar,
      nickname: user.nickname || user.login
    }
  end

  def normalize(user) when is_map(user) do
    id = Map.get(user, :id) || Map.get(user, "id")
    user_id = Map.get(user, :user_id) || Map.get(user, "user_id") || id
    login = Map.get(user, :login) || Map.get(user, "login")
    avatar = Map.get(user, :avatar) || Map.get(user, "avatar")
    nickname = Map.get(user, :nickname) || Map.get(user, "nickname") || login

    %__MODULE__{
      id: id || user_id,
      user_id: user_id,
      login: login,
      avatar: avatar,
      nickname: nickname
    }
  end

  def normalize(_), do: %__MODULE__{}

  @doc """
  Returns true when embed user data is complete enough for persistence.
  """
  @spec valid?(t()) :: boolean()
  def valid?(%__MODULE__{id: id, login: login, nickname: nickname})
      when not is_nil(id) and is_binary(login) and login != "" and is_binary(nickname) and
             nickname != "",
      do: true

  def valid?(_), do: false

  @doc """
  Returns a stable key for de-duplication.
  """
  @spec uniq_key(t()) :: String.t() | integer() | nil
  def uniq_key(%__MODULE__{login: login, user_id: user_id, id: id}), do: login || user_id || id

  def changeset(struct, params) do
    changeset =
      struct
      |> cast(params, [:id, :login, :nickname, :user_id, :avatar])
      |> ensure_primary_id()

    changeset
    |> validate_required([:id, :login, :nickname])
  end

  defp ensure_primary_id(%Ecto.Changeset{} = changeset) do
    case get_field(changeset, :id) do
      nil ->
        case get_field(changeset, :user_id) do
          nil -> changeset
          user_id -> put_change(changeset, :id, user_id)
        end

      _id ->
        changeset
    end
  end
end
