defmodule GroupherServer.Accounts.Profiles.OauthFlows do
  @moduledoc """
  Owns registration flow expiry and transactional account creation.

      Auth -> Accounts registration -> flow and identity -> Browser Session
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, Repo}
  alias Accounts.Model.OauthFlow
  alias Accounts.Profiles.{BrowserSessions, Effects, Oauth, OauthProviders}
  alias Helper.ORM.AdvisoryLock

  @ttl_seconds 600

  @doc "Creates a registration flow for an identity already verified by Auth."
  def create_registration(ref, provider, return_to) do
    attrs = %{
      ref: ref,
      purpose: "registration",
      status: "pending",
      provider: provider.provider,
      identity: provider,
      return_to: return_to,
      expires_at:
        DateTime.utc_now() |> DateTime.add(@ttl_seconds, :second) |> DateTime.truncate(:second)
    }

    changeset = OauthFlow.changeset(%OauthFlow{}, attrs)

    case Repo.insert(changeset,
           on_conflict: :nothing,
           conflict_target: [:ref],
           returning: true,
           log: false
         ) do
      {:ok, %OauthFlow{id: nil}} ->
        case Repo.get_by(OauthFlow, [ref: ref], log: false) do
          %OauthFlow{purpose: "registration", status: "pending"} = flow ->
            identity = provider |> Jason.encode!() |> Jason.decode!()

            if flow.identity == identity and flow.return_to == return_to and
                 DateTime.compare(flow.expires_at, DateTime.utc_now()) == :gt do
              {:ok, flow}
            else
              {:error, :invalid_oauth_flow}
            end

          _ ->
            {:error, :invalid_oauth_flow}
        end

      result ->
        result
    end
  end

  @doc "Checks whether a proposed login is usable for a new OAuth account."
  def available_login?(login) when is_binary(login) and byte_size(login) in 1..30 do
    Regex.match?(~r/\A[a-zA-Z0-9][a-zA-Z0-9_-]*\z/, login) and
      not Repo.exists?(from(user in Accounts.Model.User, where: user.login == ^login))
  end

  def available_login?(_login), do: false

  @doc "Returns the public summary of a live registration flow."
  def registration_summary(ref) do
    now = DateTime.utc_now()

    case Repo.one(
           from(flow in OauthFlow,
             where:
               flow.ref == ^ref and flow.purpose == "registration" and
                 flow.status == "pending" and flow.expires_at > ^now
           ),
           log: false
         ) do
      %OauthFlow{} = flow ->
        {:ok,
         %{
           provider: flow.provider,
           suggested_login: Map.get(flow.identity, "login"),
           return_to: flow.return_to
         }}

      nil ->
        {:error, :invalid_oauth_flow}
    end
  end

  @doc "Deletes expired OAuth flows."
  def cleanup_expired do
    now = DateTime.utc_now()
    {count, _} = Repo.delete_all(from(flow in OauthFlow, where: flow.expires_at <= ^now))
    {:ok, count}
  end

  @doc "Consumes a pending registration and creates its account and identity atomically."
  def complete_registration(ref, login, browser_session_metadata)
      when is_binary(login) and byte_size(login) >= 1 and byte_size(login) <= 30 do
    if Regex.match?(~r/\A[a-zA-Z0-9][a-zA-Z0-9_-]*\z/, login) do
      complete_valid_registration(ref, login, browser_session_metadata)
    else
      {:error, :invalid_login}
    end
  end

  def complete_registration(_ref, _login, _browser_session_metadata) do
    {:error, :invalid_login}
  end

  defp complete_valid_registration(ref, login, browser_session_metadata) do
    result =
      Repo.transaction(fn ->
        flow =
          OauthFlow
          |> where([f], f.ref == ^ref and f.purpose == "registration")
          |> lock("FOR UPDATE")
          |> Repo.one(log: false)

        if is_nil(flow) or flow.status != "pending" or
             DateTime.compare(flow.expires_at, DateTime.utc_now()) != :gt do
          Repo.rollback(:invalid_oauth_flow)
        end

        provider = Oauth.normalize_oauth_provider(flow.identity) |> Map.put(:login, login)

        unless OauthProviders.allow_new_identity?(provider.provider) do
          Repo.rollback(:oauth_provider_closed)
        end

        {:ok, :acquired} =
          AdvisoryLock.acquire!("oauth:#{provider.provider}:#{provider.provider_id}")

        {:ok, :acquired} = AdvisoryLock.acquire!("oauth-login:#{login}")

        unless available_login?(login) do
          Repo.rollback(:login_unavailable)
        end

        case Oauth.find_oauth_provider(provider) do
          {:ok, _identity} -> Repo.rollback(:identity_already_registered)
          {:error, _reason} -> {:ok, :available}
        end

        case Oauth.register_in_transaction(provider) do
          {:ok, user} ->
            flow
            |> Ecto.Changeset.change(status: "consumed", identity: nil)
            |> Repo.update!(log: false)

            user

          {:error, {_step, reason}} ->
            Repo.rollback(reason)
        end
      end)

    case result do
      {:ok, user} ->
        _ = Effects.oauth_registration_completed(user)
        BrowserSessions.create(user, browser_session_metadata)

      {:error, reason} ->
        {:error, reason}
    end
  end
end
