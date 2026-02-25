defmodule GroupherServer.Accounts.Profiles.Oauth do
  @moduledoc false

  import Ecto.Query, warn: false
  import Helper.ErrorCode
  import Helper.Utils, only: [keys_to_atoms: 1]
  alias GroupherServer.{Accounts, Email, Repo}
  alias GroupherServer.Accounts.FrontDesk

  alias Accounts.Model.{Achievement, OauthProvider, Social, User}

  alias Ecto.Multi
  alias Helper.{Guardian, ORM}

  def link_oauth(login, provider) do
    provider = normalize_oauth_provider(provider)

    with {:ok, user} <- FrontDesk.user(login, fill_meta: false),
         {:ok, :pass} <- assert_oauth_provider_not_linked(provider, user),
         create_profile(user, provider),
         update_profile_social(user, provider) do
      gen_token(user)
    end
  end

  def unlink_oauth(login, provider) do
    provider = normalize_oauth_provider(provider)

    with {:ok, user} <- FrontDesk.user(login, fill_meta: false),
         {:ok, oauth_provider} <- find_user_oauth_provider(user, provider) do
      {:ok, provider_count} =
        from(o in OauthProvider, where: o.user_id == ^user.id)
        |> ORM.count()

      case provider_count do
        1 ->
          {:error, [message: "can not delete last oauth provider", code: ecode(:oauth_unlink)]}

        _ ->
          oauth_provider |> ORM.delete()
      end
    end
  end

  def signin_oauth(provider) do
    provider = normalize_oauth_provider(provider)

    case find_oauth_provider(provider) do
      {:ok, oauth_provider} ->
        {:ok, user} = FrontDesk.user(oauth_provider.user_id, fill_meta: false)
        gen_token(user)

      {:error, _} ->
        register_oauth_user(provider)
    end
  end

  def update_profile_social(user, %{provider: "github"} = profile) do
    update_social_ifneed(user, %{
      social: %{
        github: "https://github.com/#{profile.login}"
      }
    })
  end

  def update_profile_social(_, _), do: {:ok, :pass}

  defp find_oauth_provider(provider) do
    OauthProvider
    |> ORM.find_by(
      provider: provider.provider,
      provider_id: provider.provider_id
    )
  end

  defp normalize_oauth_provider(provider) when is_map(provider) do
    raw = Map.get(provider, :raw, Map.get(provider, "raw"))

    provider
    |> Map.drop([:raw, "raw"])
    |> keys_to_atoms()
    |> maybe_put_raw(raw)
  end

  defp maybe_put_raw(provider, %{} = raw), do: Map.put(provider, :raw, raw)
  defp maybe_put_raw(provider, raw) when is_list(raw), do: Map.put(provider, :raw, raw)
  defp maybe_put_raw(provider, _raw), do: provider

  defp find_user_oauth_provider(%User{} = user, provider) do
    OauthProvider
    |> ORM.find_by(
      user_id: user.id,
      provider: provider.provider,
      provider_id: provider.provider_id
    )
  end

  defp assert_oauth_provider_not_linked(provider, %User{} = user) do
    case find_oauth_provider(provider) do
      {:ok, oauth_provider} when oauth_provider.user_id == user.id ->
        {:ok, :pass}

      {:ok, _oauth_provider} ->
        raise_error(:already_exist, "oauth provider already linked")

      {:error, _} ->
        {:ok, :pass}
    end
  end

  defp register_oauth_user(oauth_profile) do
    Multi.new()
    |> Multi.run(:create_user, fn _, _ ->
      create_user(oauth_profile)
    end)
    |> Multi.run(:create_profile, fn _, %{create_user: user} ->
      create_profile(user, oauth_profile)
    end)
    |> Multi.run(:update_profile_social, fn _, %{create_user: user} ->
      update_profile_social(user, oauth_profile)
    end)
    |> Multi.run(:init_achievement, fn _, %{create_user: user} ->
      Achievement |> ORM.upsert_by([user_id: user.id], %{user_id: user.id})
    end)
    |> Repo.transaction()
    |> register_oauth_result()
  end

  defp gen_token(%User{} = user) do
    with {:ok, token, _info} <- Guardian.jwt_encode(user) do
      {:ok, %{token: token, user: user}}
    end
  end

  defp create_user(profile) do
    attrs = %{
      login: profile.login,
      nickname: profile.nickname,
      avatar: profile.avatar,
      bio: profile |> Map.get(:bio, ""),
      email: profile |> Map.get(:email, ""),
      company: profile |> Map.get(:company, "")
    }

    User |> ORM.create(attrs)
  end

  defp create_profile(user, oauth_profile) do
    attrs = Map.merge(oauth_profile, %{user_id: user.id})

    OauthProvider
    |> ORM.upsert_by(
      [provider: oauth_profile.provider, provider_id: oauth_profile.provider_id],
      attrs
    )
  end

  defp update_social_ifneed(%User{} = user, %{social: attrs}) do
    attrs = Map.merge(%{user_id: user.id}, attrs)
    Social |> ORM.upsert_by([user_id: user.id], attrs)
  end

  defp register_oauth_result({:ok, %{create_user: create_user}}) do
    {:ok, user} = FrontDesk.user(create_user.id, preload: :oauth_providers, fill_meta: false)

    with {:ok, result} <- gen_token(user) do
      Email.welcome(user)
      Email.notify_admin(user, :new_register)

      {:ok, result}
    end
  end

  defp register_oauth_result({:error, :create_user, %Ecto.Changeset{} = result, _steps}),
    do: {:error, result}

  defp register_oauth_result({:error, :create_user, _result, _steps}),
    do: {:error, "Accounts create_user internal error"}

  defp register_oauth_result({:error, :create_profile, _result, _steps}),
    do: {:error, "Accounts create_profile internal error"}

  defp register_oauth_result({:error, :update_profile_social, _result, _steps}),
    do: {:error, "Accounts update_profile_social error"}
end
