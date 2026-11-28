defmodule GroupherServer.Accounts.Profiles.OauthLinks do
  @moduledoc """
  Owns browser-bound link state and transactional confirmation.

      Auth callback -> Accounts link flow -> confirmed identity binding
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, Repo}
  alias Accounts.Model.{OauthFlow, User}
  alias Accounts.Profiles.{BrowserSessions, Oauth, OauthProviders}

  @doc "Creates an authorization flow after checking the current browser session."
  def start(%User{} = user, attrs) do
    Repo.transaction(fn ->
      with {:ok, _} <- BrowserSessions.require_recent(attrs.browser_session_ref, user.id),
           true <- OauthProviders.allow_new_identity?(attrs.provider),
           {:ok, flow} <-
             %OauthFlow{}
             |> OauthFlow.changeset(%{
               ref: attrs.ref,
               purpose: "link",
               status: "pending",
               provider: attrs.provider,
               browser_session_ref: attrs.browser_session_ref,
               code_verifier: attrs.code_verifier,
               nonce: attrs.nonce,
               return_to: attrs.return_to,
               expires_at: DateTime.utc_now(:second) |> DateTime.add(600, :second)
             })
             |> Repo.insert(
               log: false,
               on_conflict: :nothing,
               conflict_target: [:ref],
               returning: true
             ),
           {:ok, flow} <- match_pending_flow(flow, attrs) do
        flow
      else
        false -> Repo.rollback(:oauth_provider_closed)
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp match_pending_flow(%OauthFlow{id: nil}, attrs) do
    case Repo.get_by(OauthFlow, [ref: attrs.ref], log: false) do
      %OauthFlow{purpose: "link", status: "pending"} = flow ->
        if flow.provider == attrs.provider and
             flow.browser_session_ref == attrs.browser_session_ref and
             flow.code_verifier == attrs.code_verifier and flow.nonce == attrs.nonce and
             flow.return_to == attrs.return_to and
             DateTime.compare(flow.expires_at, DateTime.utc_now()) == :gt do
          {:ok, flow}
        else
          {:error, :invalid_oauth_flow}
        end

      _ ->
        {:error, :invalid_oauth_flow}
    end
  end

  defp match_pending_flow(%OauthFlow{} = flow, _attrs), do: {:ok, flow}

  @doc "Atomically claims a callback and returns its one-time exchange verifier."
  def claim(%User{} = user, ref, session_ref, provider, nonce) do
    transact(user, ref, session_ref, "pending", fn flow ->
      if flow.provider != provider or flow.nonce != nonce do
        Repo.rollback(:invalid_oauth_flow)
      end

      verifier = flow.code_verifier

      flow
      |> Ecto.Changeset.change(status: "exchanging", code_verifier: nil, nonce: nil)
      |> Repo.update!(log: false)

      %{code_verifier: verifier, return_to: flow.return_to}
    end)
  end

  @doc "Records the verified identity for user confirmation."
  def verified(%User{} = user, ref, session_ref, identity) do
    transact(user, ref, session_ref, "exchanging", fn flow ->
      identity = Oauth.normalize_oauth_provider(identity)
      if flow.provider != identity.provider, do: Repo.rollback(:invalid_oauth_flow)

      case Oauth.find_oauth_provider(identity) do
        {:ok, %{user_id: owner}} when owner == user.id ->
          flow |> Ecto.Changeset.change(status: "consumed") |> Repo.update!(log: false)
          %{status: "already_linked", return_to: flow.return_to}

        {:ok, _} ->
          Repo.rollback(:identity_already_linked)

        {:error, _} ->
          flow
          |> Ecto.Changeset.change(status: "confirm", identity: identity)
          |> Repo.update!(log: false)

          %{status: "confirm", return_to: flow.return_to}
      end
    end)
  end

  @doc "Returns the identity awaiting confirmation for this browser session."
  def summary(%User{} = user, ref, session_ref) do
    transact(user, ref, session_ref, "confirm", fn flow ->
      identity = Oauth.normalize_oauth_provider(flow.identity)

      %{
        provider: identity.provider,
        provider_id: identity.provider_id,
        login: identity[:login],
        return_to: flow.return_to
      }
    end)
  end

  @doc "Cancels an exchange or verified identity awaiting confirmation."
  def cancel(%User{} = user, ref, session_ref) do
    transact(user, ref, session_ref, ["exchanging", "confirm"], fn flow ->
      flow
      |> Ecto.Changeset.change(status: "cancelled", identity: nil)
      |> Repo.update!(log: false)

      %{done: true}
    end)
  end

  @doc "Rechecks and writes the binding while consuming the flow in the same transaction."
  def confirm(%User{} = user, ref, session_ref, provider, provider_id) do
    transact(user, ref, session_ref, "confirm", fn flow ->
      identity = Oauth.normalize_oauth_provider(flow.identity)

      if identity.provider != provider or identity.provider_id != provider_id do
        Repo.rollback(:invalid_oauth_flow)
      end

      unless OauthProviders.allow_new_identity?(provider) do
        Repo.rollback(:oauth_provider_closed)
      end

      case Oauth.link_in_transaction(user.login, identity) do
        {:ok, _user} ->
          flow
          |> Ecto.Changeset.change(status: "consumed", identity: nil)
          |> Repo.update!(log: false)

          %{return_to: flow.return_to}

        {:error, reason} ->
          Repo.rollback(reason)
      end
    end)
  end

  defp transact(user, ref, session_ref, status, fun) do
    Repo.transaction(fn ->
      with {:ok, _} <- BrowserSessions.require_recent(session_ref, user.id) do
        now = DateTime.utc_now()

        flow =
          Repo.one(
            from(f in OauthFlow,
              where: f.ref == ^ref and f.purpose == "link",
              lock: "FOR UPDATE"
            ),
            log: false
          )

        if is_nil(flow) or flow.status not in List.wrap(status) or
             flow.browser_session_ref != session_ref or
             DateTime.compare(flow.expires_at, now) != :gt do
          Repo.rollback(:invalid_oauth_flow)
        end

        fun.(flow)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end
end
