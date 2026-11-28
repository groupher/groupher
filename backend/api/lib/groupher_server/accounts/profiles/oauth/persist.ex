defmodule GroupherServer.Accounts.Profiles.Oauth.Persist do
  @moduledoc """
  Owns OAuth user, binding and social row primitives.

  Commands own the transaction around these operations; this module never
  opens a transaction or decides whether an identity may be linked.

      Profiles.Commands -> Profiles.Oauth -> Oauth.Persist -> rows
  """

  import Ecto.Query, warn: false
  alias GroupherServer.{Accounts, ErrorCat, Repo}
  alias Accounts.Model.{OauthProvider, Social, User}
  alias Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias Helper.ORM

  @doc """
  Locks an existing user for a caller-owned OAuth mutation.

  ## Examples

      Accounts.Profiles.Oauth.Persist.lock_user("alice")
  """
  @spec lock_user(String.t()) :: {:ok, User.t()} | {:error, term()}
  def lock_user(login) do
    case ORM.find_by(User, login: login) do
      {:ok, user} ->
        User
        |> where(id: ^user.id)
        |> lock("FOR UPDATE")
        |> Repo.one()
        |> case do
          %User{} = locked_user ->
            {:ok, locked_user}

          nil ->
            {:error,
             message: "user no longer exists",
             code: ErrorCat.code(ProfileErrorCat.account_login())}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Creates the user row derived from a verified OAuth profile.

  ## Examples

      Accounts.Profiles.Oauth.Persist.create_user(provider_payload)
  """
  @spec create_user(map()) :: {:ok, User.t()} | {:error, term()}
  def create_user(profile) do
    attrs = %{
      login: registration_login(profile),
      nickname: Map.get(profile, :nickname) || registration_login(profile),
      avatar:
        Map.get(profile, :avatar) || "https://static.groupher.com/icons/cmd/alien_user3.svg",
      bio: profile |> Map.get(:bio, ""),
      email: profile |> Map.get(:email, ""),
      company: profile |> Map.get(:company, "")
    }

    User |> ORM.create(attrs)
  end

  @doc """
  Creates the OAuth binding for an account.

  ## Examples

      Accounts.Profiles.Oauth.Persist.create_profile(user, provider_payload)
  """
  @spec create_profile(User.t(), map()) :: {:ok, OauthProvider.t()} | {:error, term()}
  def create_profile(user, oauth_profile) do
    attrs =
      oauth_profile
      |> Map.take(
        ~w(provider provider_id login nickname avatar email locale link bio country city company)a
      )
      |> Map.merge(%{user_id: user.id, public_ref: new_public_ref()})

    ORM.create(OauthProvider, attrs)
  end

  @doc """
  Refreshes binding metadata for an already linked identity.

  ## Examples

      Accounts.Profiles.Oauth.Persist.refresh_binding(binding, provider_payload)
  """
  @spec refresh_binding(OauthProvider.t(), map()) :: {:ok, :pass} | {:error, term()}
  def refresh_binding(binding, provider) do
    binding
    |> ORM.update(
      Map.take(provider, ~w(login nickname avatar email locale link bio country city company)a),
      strict: false
    )
    |> case do
      {:ok, _binding} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Updates derived social fields for an OAuth profile.

  ## Examples

      Accounts.Profiles.Oauth.Persist.update_profile_social(user, %{provider: "github", login: "alice"})
  """
  @spec update_profile_social(User.t(), map()) :: {:ok, term()} | {:error, term()}
  def update_profile_social(%User{} = user, %{provider: "github", login: login} = profile)
      when is_binary(login) and login != "" do
    update_social_ifneed(user, %{
      social: %{
        github: "https://github.com/#{profile.login}"
      }
    })
  end

  def update_profile_social(_, _), do: {:ok, :pass}

  @doc """
  Deletes an OAuth binding in the caller-owned transaction.

  ## Examples

      Accounts.Profiles.Oauth.Persist.delete_binding(binding)
  """
  @spec delete_binding(OauthProvider.t()) :: {:ok, OauthProvider.t()} | {:error, term()}
  def delete_binding(binding), do: ORM.delete(binding)

  @doc """
  Clears a social field only when it still matches the OAuth-derived value.

  ## Examples

      Accounts.Profiles.Oauth.Persist.clear_derived_social(user, binding)
  """
  @spec clear_derived_social(User.t(), OauthProvider.t()) :: {:ok, :pass} | {:error, term()}
  def clear_derived_social(%User{id: user_id}, %OauthProvider{provider: "github", login: login})
      when is_binary(login) do
    case ORM.find_by(Social, user_id: user_id) do
      {:ok, %{github: "https://github.com/" <> ^login} = social} ->
        ORM.update(social, %{github: nil}, strict: false)
        |> case do
          {:ok, _} -> {:ok, :pass}
          error -> error
        end

      _ ->
        {:ok, :pass}
    end
  end

  def clear_derived_social(_user, _provider), do: {:ok, :pass}

  defp update_social_ifneed(%User{} = user, %{social: attrs}) do
    attrs = Map.merge(%{user_id: user.id}, attrs)
    Social |> ORM.upsert_by([user_id: user.id], attrs)
  end

  defp registration_login(profile) do
    profile
    |> Map.get(:registration_login)
    |> blank_to_nil()
    |> Kernel.||(profile |> Map.get(:login) |> blank_to_nil())
    |> Kernel.||(profile |> Map.get(:nickname) |> blank_to_nil())
    |> Kernel.||(profile |> Map.get(:email) |> email_local_part())
    |> Kernel.||("oauth_" <> to_string(profile.provider_id))
  end

  defp email_local_part(email) when is_binary(email) do
    email |> String.split("@", parts: 2) |> List.first() |> blank_to_nil()
  end

  defp email_local_part(_), do: nil

  defp blank_to_nil(value) when is_binary(value) do
    if String.trim(value) == "", do: nil, else: value
  end

  defp blank_to_nil(_), do: nil

  defp new_public_ref do
    "oauth_" <> Base.url_encode64(:crypto.strong_rand_bytes(18), padding: false)
  end
end
