defmodule GroupherServer.Accounts.Profiles.Oauth.Workflow do
  @moduledoc """
  OAuth sign-in and account-linking workflow. Commands own transactions;
  `Oauth` coordinates identity lookup, registration steps and domain errors.

      provider payload -> Profiles.Commands
          +--> Oauth query -> BrowserSessions
          +--> Oauth registration Multi -> Oauth.Persist -> Effects
          +--> link/unlink Oauth.Persist -> Effects

  Browser Session creation and post-registration delivery remain explicit
  command effects rather than hidden transaction work.
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [keys_to_atoms: 1]

  alias GroupherServer.{Accounts, Repo}
  alias Accounts.Model.{OauthProvider, User}
  alias Accounts.Profiles.Oauth.Persist, as: OauthPersist
  alias Accounts.Profiles.OauthProviders

  alias Helper.{Multi, ORM}

  @doc """
  Links an OAuth identity inside a caller-owned transaction.

  Commands own the transaction boundary; this module only coordinates the
  row-level OAuth operations and returns a tagged result.

  ## Examples

      Accounts.Profiles.Oauth.link_in_transaction("alice", provider_payload)
  """
  @spec link_in_transaction(String.t(), map()) :: {:ok, User.t()} | {:error, term()}
  def link_in_transaction(login, provider) do
    provider = normalize_oauth_provider(provider)

    with {:ok, user} <- OauthPersist.lock_user(login) do
      case find_oauth_provider(provider) do
        {:ok, %OauthProvider{user_id: user_id} = oauth_provider} when user_id == user.id ->
          # Linking the same identity again is idempotent. Only binding
          # metadata may be refreshed; User/Profile/Social remain untouched.
          with {:ok, :pass} <- OauthPersist.refresh_binding(oauth_provider, provider) do
            {:ok, user}
          end

        {:ok, _oauth_provider} ->
          {:error, oauth_identity_already_linked_error()}

        {:error, _} ->
          link_missing_identity(user, provider)
      end
    end
  end

  defp link_missing_identity(user, provider) do
    if OauthProviders.allow_new_identity?(provider.provider) do
      link_available_identity(user, provider)
    else
      {:error, "OAuth provider does not accept new identities"}
    end
  end

  defp link_available_identity(user, provider) do
    case find_user_provider(user, provider.provider) do
      {:ok, _existing} -> {:error, oauth_provider_already_linked_error()}
      {:error, _} -> create_provider_binding(user, provider)
    end
  end

  defp create_provider_binding(user, provider) do
    case OauthPersist.create_profile(user, provider) do
      {:ok, _binding} -> {:ok, user}
      {:error, changeset} -> {:error, classify_link_insert_error(changeset, provider, user)}
    end
  end

  @doc """
  Unlinks an OAuth identity inside a caller-owned transaction.

  ## Examples

      Accounts.Profiles.Oauth.unlink_in_transaction("alice", provider_payload)
  """
  @spec unlink_in_transaction(String.t(), map()) :: {:ok, User.t()} | {:error, term()}
  def unlink_in_transaction(login, provider) do
    provider = normalize_oauth_provider(provider)

    with {:ok, user} <- OauthPersist.lock_user(login),
         {:ok, oauth_provider} <- find_user_oauth_provider(user, provider),
         {:ok, :pass} <- ensure_other_login_method(user, oauth_provider),
         {:ok, _deleted} <- OauthPersist.delete_binding(oauth_provider),
         {:ok, :pass} <- OauthPersist.clear_derived_social(user, oauth_provider) do
      {:ok, user}
    else
      {:error, _} = error -> error
      :error -> {:error, oauth_last_login_method_error()}
    end
  end

  @doc """
  Normalizes provider input before it enters an OAuth command.

  ## Examples

      Accounts.Profiles.Oauth.normalize_oauth_provider(%{"provider" => "github"})
  """
  @spec normalize_oauth_provider(map()) :: map()
  def normalize_oauth_provider(provider) when is_map(provider) do
    provider
    |> Map.drop([:raw, "raw"])
    |> keys_to_atoms()
  end

  @doc """
  Removes one OAuth identity by its public reference inside a caller-owned transaction.

  ## Examples

      Accounts.Profiles.Oauth.unlink_identity_in_transaction("alice", public_ref)
  """
  @spec unlink_identity_in_transaction(String.t(), String.t()) ::
          {:ok, User.t()} | {:error, term()}
  def unlink_identity_in_transaction(login, public_ref) do
    with {:ok, user} <- OauthPersist.lock_user(login),
         {:ok, binding} <- find_user_oauth_identity(user, public_ref),
         {:ok, :pass} <- ensure_other_login_method(user, binding),
         {:ok, _deleted} <- OauthPersist.delete_binding(binding),
         {:ok, :pass} <- OauthPersist.clear_derived_social(user, binding) do
      {:ok, user}
    else
      {:error, _} = error -> error
      :error -> {:error, oauth_last_login_method_error()}
    end
  end

  @doc """
  Returns the OAuth binding for a verified provider identity.

  ## Examples

      Accounts.Profiles.Oauth.find_oauth_provider(%{provider: "github", provider_id: "123"})
  """
  @spec find_oauth_provider(map()) :: {:ok, OauthProvider.t()} | {:error, term()}
  def find_oauth_provider(provider) do
    OauthProvider
    |> ORM.find_by([provider: provider.provider, provider_id: provider.provider_id],
      preload: :user
    )
  end

  @doc """
  Returns a registration transaction for a verified OAuth identity.

  ## Examples

      Accounts.Profiles.Oauth.registration_multi(%{provider: "github", provider_id: "123"})
  """
  @spec registration_multi(map()) :: Ecto.Multi.t()
  def registration_multi(oauth_profile) do
    Multi.new()
    |> Multi.run(:create_user, fn _, _ -> OauthPersist.create_user(oauth_profile) end)
    |> Multi.run(:create_profile, fn _, %{create_user: user} ->
      OauthPersist.create_profile(user, oauth_profile)
    end)
    |> Multi.run(:update_profile_social, fn _, %{create_user: user} ->
      OauthPersist.update_profile_social(user, oauth_profile)
    end)
    |> Multi.run(:init_achievement, fn _, %{create_user: user} ->
      Accounts.Achievements.Persist.ensure(user.id)
    end)
  end

  @doc """
  Registers an OAuth account in the caller's current transaction.

  The command pipeline owns the transaction; this function only performs the
  ordered row writes and tags the failing step so a caller can recover a
  concurrent first-registration race without opening a nested transaction.
  """
  @spec register_in_transaction(map()) :: {:ok, User.t()} | {:error, {atom(), term()}}
  def register_in_transaction(oauth_profile) do
    with {:ok, user} <- tag_registration(:create_user, OauthPersist.create_user(oauth_profile)),
         {:ok, _binding} <-
           tag_registration(:create_profile, OauthPersist.create_profile(user, oauth_profile)),
         {:ok, _social} <-
           tag_registration(
             :update_profile_social,
             OauthPersist.update_profile_social(user, oauth_profile)
           ),
         {:ok, _achievement} <-
           tag_registration(:init_achievement, Accounts.Achievements.Persist.ensure(user.id)) do
      {:ok, user}
    end
  end

  defp tag_registration(_step, {:ok, value}), do: {:ok, value}
  defp tag_registration(step, {:error, reason}), do: {:error, {step, reason}}

  @doc """
  Reuses a committed OAuth identity when concurrent registration raced.

  ## Examples

      Accounts.Profiles.Oauth.recover_registration_race({:ok, %{}}, provider_payload)
  """
  @spec recover_registration_race(term(), map()) :: term()
  def recover_registration_race(
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

  def recover_registration_race(result, _oauth_profile), do: result

  @doc """
  Converts an OAuth registration transaction result to its canonical user result.

  ## Examples

      Accounts.Profiles.Oauth.registration_result({:ok, %{create_user: user}})
  """
  @spec registration_result(term()) :: {:ok, User.t()} | {:error, term()}
  def registration_result({:ok, %{create_user: create_user}}) do
    ORM.find_by(User, [login: create_user.login], preload: :oauth_providers)
  end

  def registration_result({:error, :create_user, %Ecto.Changeset{} = result, _steps}) do
    {:error, result}
  end

  def registration_result({:error, :create_user, _result, _steps}) do
    {:error, "Accounts create_user internal error"}
  end

  def registration_result({:error, :create_profile, _result, _steps}) do
    {:error, "Accounts create_profile internal error"}
  end

  def registration_result({:error, :update_profile_social, _result, _steps}) do
    {:error, "Accounts update_profile_social error"}
  end

  @doc """
  Updates derived social fields for an OAuth profile inside a caller transaction.

  ## Examples

      Accounts.Profiles.Oauth.update_profile_social(user, %{provider: "github", login: "alice"})
  """
  @spec update_profile_social(User.t(), map()) :: {:ok, term()} | {:error, term()}
  def update_profile_social(user, profile), do: OauthPersist.update_profile_social(user, profile)

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

  defp find_user_oauth_identity(%User{} = user, public_ref) do
    case ORM.find_by(OauthProvider, user_id: user.id, public_ref: public_ref) do
      {:ok, binding} -> {:ok, binding}
      {:error, _reason} -> {:error, oauth_binding_not_found_error()}
    end
  end

  defp ensure_other_login_method(%User{} = user, binding) do
    remaining =
      from(o in OauthProvider,
        where: o.user_id == ^user.id and o.id != ^binding.id,
        select: o.provider
      )
      |> Repo.all()

    if Enum.any?(remaining, &OauthProviders.allow_sign_in?/1) do
      {:ok, :pass}
    else
      {:error, oauth_last_login_method_error()}
    end
  end

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

  defp oauth_identity_already_linked_error do
    [
      message: "oauth identity already linked",
      code: GroupherServer.Auth.contract_oauth_identity_already_linked()
    ]
  end

  defp oauth_provider_already_linked_error do
    [
      message: "oauth provider already linked",
      code: GroupherServer.Auth.contract_oauth_provider_already_linked()
    ]
  end

  defp oauth_last_login_method_error do
    [
      message: "can not delete last oauth provider",
      code: GroupherServer.Auth.contract_oauth_last_login_method()
    ]
  end

  defp oauth_binding_not_found_error do
    [
      message: "oauth binding not found",
      code: GroupherServer.Auth.contract_oauth_binding_not_found()
    ]
  end
end
