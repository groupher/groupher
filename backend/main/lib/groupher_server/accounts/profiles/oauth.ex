defmodule GroupherServer.Accounts.Profiles.Oauth do
  @moduledoc """
  OAuth sign-in and account-linking workflow.

      provider payload
          |
          +--> find existing provider -> token
          +--> register user/provider -> token
          +--> link/unlink provider for existing user

  The workflow keeps provider records, achievement bootstrap, social profile
  hints, Browser Session creation, mailbox bootstrap, and user revalidation in
  one account domain boundary.
  """

  import Ecto.Query, warn: false
  import Helper.ErrorCode
  import Helper.Utils, only: [keys_to_atoms: 1]

  alias GroupherServer.{Accounts, Messaging, Repo}
  alias GroupherServer.FrontDesk, as: RootFrontDesk

  alias Accounts.FrontDesk
  alias Accounts.Model.{Achievement, OauthProvider, Social, User}
  alias Accounts.Profiles.BrowserSessions
  alias Helper.{Multi, ORM}

  def link_oauth(login, provider) do
    provider = normalize_oauth_provider(provider)

    Repo.transaction(fn ->
      user = lock_live_user!(login)

      case find_oauth_provider(provider) do
        {:ok, %OauthProvider{user_id: user_id} = oauth_provider} when user_id == user.id ->
          # Linking the same identity again is idempotent. Only binding
          # metadata may be refreshed; User/Profile/Social remain untouched.
          refresh_binding_metadata(oauth_provider, provider)
          # Account audit persistence is deferred until an Accounts-owned
          # append-only audit sink exists; this transaction is not audited yet.
          user

        {:ok, _oauth_provider} ->
          Repo.rollback(oauth_identity_already_linked_error())

        {:error, _} ->
          case find_user_provider(user, provider.provider) do
            {:ok, _existing} ->
              Repo.rollback(oauth_provider_already_linked_error())

            {:error, _} ->
              case create_profile(user, provider) do
                {:ok, _binding} ->
                  # Account audit persistence is deferred until an
                  # Accounts-owned append-only audit sink exists.
                  user

                {:error, changeset} ->
                  Repo.rollback(classify_link_insert_error(changeset, provider, user))
              end
          end
      end
    end)
    |> case do
      {:ok, %User{} = user} = result ->
        RootFrontDesk.revalidate().user(user.login)
        result

      {:error, reason} ->
        {:error, reason}
    end
  end

  def unlink_oauth(login, provider) do
    provider = normalize_oauth_provider(provider)

    Repo.transaction(fn ->
      user = lock_live_user!(login)

      oauth_provider =
        case find_user_oauth_provider(user, provider) do
          {:ok, binding} -> binding
          {:error, _} -> Repo.rollback(oauth_binding_not_found_error())
        end

      provider_count =
        from(o in OauthProvider, where: o.user_id == ^user.id)
        |> Repo.aggregate(:count, :id)

      if provider_count <= 1 do
        Repo.rollback(oauth_last_login_method_error())
      end

      with {:ok, _deleted} <- ORM.delete(oauth_provider),
           {:ok, :pass} <- clear_derived_social(user, oauth_provider) do
        # Account audit persistence is intentionally deferred; this mutation
        # remains atomic, but no audit event is emitted by this V1 slice.
        user
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
    |> case do
      {:ok, %User{} = user} = result ->
        RootFrontDesk.revalidate().user(user.login)
        result

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc "Returns the canonical linked-account projection for an active user."
  def linked_oauth_accounts(login) do
    with {:ok, user} <- FrontDesk.live_user(login, fill_meta: false) do
      bindings =
        OauthProvider
        |> where([binding], binding.user_id == ^user.id)
        |> order_by([binding], asc: binding.inserted_at, asc: binding.id)
        |> Repo.all()

      can_unlink = length(bindings) > 1

      {:ok,
       %{
         entries:
           Enum.map(bindings, fn binding ->
             %{
               public_ref: binding.public_ref,
               provider: binding.provider,
               login: binding.login,
               nickname: binding.nickname,
               avatar: binding.avatar,
               can_unlink: can_unlink,
               linked_at: binding.inserted_at
             }
           end)
       }}
    end
  end

  @doc "Links a verified identity and returns the canonical account projection."
  def link_oauth_identity(login, provider) do
    with {:ok, _user} <- link_oauth(login, provider),
         do: linked_oauth_accounts(login)
  end

  @doc "Unlinks one owned binding by its opaque public reference."
  def unlink_oauth_identity(login, public_ref) do
    result =
      Repo.transaction(fn ->
        user = lock_live_user!(login)

        binding =
          case ORM.find_by(OauthProvider, user_id: user.id, public_ref: public_ref) do
            {:ok, binding} -> binding
            {:error, _} -> Repo.rollback(oauth_binding_not_found_error())
          end

        provider_count =
          from(binding in OauthProvider, where: binding.user_id == ^user.id)
          |> Repo.aggregate(:count, :id)

        if provider_count <= 1 do
          Repo.rollback(oauth_last_login_method_error())
        end

        with {:ok, _deleted} <- ORM.delete(binding),
             {:ok, :pass} <- clear_derived_social(user, binding) do
          user
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)

    case result do
      {:ok, %User{} = user} ->
        RootFrontDesk.revalidate().user(user.login)
        linked_oauth_accounts(login)

      {:error, reason} ->
        {:error, reason}
    end
  end

  def signin_oauth(provider, browser_session_metadata \\ %{}) do
    provider = normalize_oauth_provider(provider)

    case find_oauth_provider(provider) do
      {:ok, oauth_provider} ->
        BrowserSessions.create(oauth_provider.user, browser_session_metadata)

      {:error, _} ->
        register_oauth_user(provider, browser_session_metadata)
    end
  end

  def update_profile_social(user, %{provider: "github", login: login} = profile)
      when is_binary(login) and login != "" do
    update_social_ifneed(user, %{
      social: %{
        github: "https://github.com/#{profile.login}"
      }
    })
  end

  def update_profile_social(_, _), do: {:ok, :pass}

  defp find_oauth_provider(provider) do
    OauthProvider
    |> ORM.find_by([provider: provider.provider, provider_id: provider.provider_id],
      preload: :user
    )
  end

  defp normalize_oauth_provider(provider) when is_map(provider) do
    provider
    |> Map.drop([:raw, "raw"])
    |> keys_to_atoms()
  end

  defp find_user_oauth_provider(%User{} = user, provider) do
    OauthProvider
    |> ORM.find_by(
      user_id: user.id,
      provider: provider.provider,
      provider_id: provider.provider_id
    )
  end

  defp find_user_provider(%User{} = user, provider) do
    OauthProvider
    |> ORM.find_by(user_id: user.id, provider: provider)
  end

  defp lock_live_user!(login) do
    case FrontDesk.live_user(login, fill_meta: false) do
      {:ok, user} ->
        User
        |> where(id: ^user.id)
        |> lock("FOR UPDATE")
        |> Repo.one()
        |> case do
          %User{} = locked_user -> locked_user
          nil -> Repo.rollback(message: "user no longer exists", code: ecode(:account_login))
        end

      {:error, reason} ->
        Repo.rollback(reason)
    end
  end

  defp register_oauth_user(oauth_profile, browser_session_metadata) do
    transaction_result =
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

    case recover_registration_race(transaction_result, oauth_profile) do
      {:ok, %{create_user: user}, :reused} ->
        BrowserSessions.create(user, browser_session_metadata)

      result ->
        result
        |> register_oauth_result()
        |> case do
          {:ok, user} -> BrowserSessions.create(user, browser_session_metadata)
          error -> error
        end
    end
  end

  # Two callbacks can pass the initial identity lookup before either has
  # committed. The unique identity index rejects the loser inside the
  # registration transaction. Once that transaction rolls back, reuse the
  # winner's committed binding instead of surfacing a sign-in error.
  defp recover_registration_race(
         {:error, step, _result, _steps} = failure,
         oauth_profile
       )
       when step in [:create_user, :create_profile] do
    case find_oauth_provider(oauth_profile) do
      {:ok, %{user: user}} ->
        {:ok, %{create_user: user}, :reused}

      {:error, _} ->
        failure
    end
  end

  defp recover_registration_race(result, _oauth_profile), do: result

  defp create_user(profile) do
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

  defp create_profile(user, oauth_profile) do
    attrs =
      oauth_profile
      |> Map.take(
        ~w(provider provider_id login nickname avatar email locale link bio country city company)a
      )
      |> Map.merge(%{user_id: user.id, public_ref: new_public_ref()})

    ORM.create(OauthProvider, attrs)
  end

  defp refresh_binding_metadata(binding, provider) do
    binding
    |> ORM.update(
      Map.take(provider, ~w(login nickname avatar email locale link bio country city company)a),
      strict: false
    )
    |> case do
      {:ok, _binding} -> :ok
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp registration_login(profile) do
    profile
    |> Map.get(:login)
    |> blank_to_nil()
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

  defp clear_derived_social(%User{id: user_id}, %OauthProvider{provider: "github", login: login})
       when is_binary(login) do
    # Temporary value-equality fallback: field-level provenance is not
    # persisted yet, so an equal user-authored URL could also be cleared.
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

  defp clear_derived_social(_user, _provider), do: {:ok, :pass}

  defp classify_link_insert_error(%Ecto.Changeset{} = changeset, provider, user) do
    cond do
      unique_constraint_error?(changeset, :oauth_providers_provider_provider_id_index) ->
        oauth_identity_already_linked_error()

      unique_constraint_error?(changeset, :oauth_providers_user_id_provider_index) ->
        oauth_provider_already_linked_error()

      true ->
        changeset
    end
    |> canonicalize_link_conflict(provider, user)
  end

  defp canonicalize_link_conflict(%Ecto.Changeset{} = changeset, provider, user) do
    case {find_oauth_provider(provider), find_user_provider(user, provider.provider)} do
      {{:ok, %{user_id: user_id}}, _} when user_id != user.id ->
        oauth_identity_already_linked_error()

      {_, {:ok, _}} ->
        oauth_provider_already_linked_error()

      _ ->
        changeset
    end
  end

  defp unique_constraint_error?(%Ecto.Changeset{errors: errors}, constraint_name) do
    Enum.any?(errors, fn {_field, {_message, opts}} -> opts[:constraint] == constraint_name end)
  end

  defp oauth_identity_already_linked_error,
    do: [message: "oauth identity already linked", code: "OAUTH_IDENTITY_ALREADY_LINKED"]

  defp oauth_provider_already_linked_error,
    do: [message: "oauth provider already linked", code: "OAUTH_PROVIDER_ALREADY_LINKED"]

  defp oauth_binding_not_found_error,
    do: [message: "oauth binding not found", code: "OAUTH_BINDING_NOT_FOUND"]

  defp oauth_last_login_method_error,
    do: [message: "can not delete last oauth provider", code: "OAUTH_LAST_LOGIN_METHOD"]

  defp update_social_ifneed(%User{} = user, %{social: attrs}) do
    attrs = Map.merge(%{user_id: user.id}, attrs)
    Social |> ORM.upsert_by([user_id: user.id], attrs)
  end

  defp register_oauth_result({:ok, %{create_user: create_user}}) do
    {:ok, user} =
      FrontDesk.live_user(create_user.login, preload: :oauth_providers, fill_meta: false)

    RootFrontDesk.revalidate().user(user.login)

    Messaging.notify(:welcome_new_register, %{
      user_id: user.id,
      login: user.login,
      nickname: user.nickname,
      email: user.email
    })

    Messaging.notify(:notify_admin_new_register, %{
      user_id: user.id,
      login: user.login,
      nickname: user.nickname,
      email: user.email
    })

    {:ok, user}
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
