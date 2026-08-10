defmodule GroupherServer.Accounts.Profiles.BrowserSessions do
  @moduledoc """
  Browser Session lifecycle for trusted Auth-to-Phoenix operations.

      OAuth identity -> persisted Session -> 30-minute browser access token
      refresh/logout/revoke -> ownership and absolute-expiry checks here

  Browser clients never call this module through regular browser GraphQL; Auth
  holds the internal ref and invokes its trusted GraphQL operations.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Repo
  alias GroupherServer.Accounts.Model.{BrowserSession, User}
  alias Helper.Guardian.BrowserAccess

  @absolute_ttl_seconds 90 * 24 * 60 * 60

  @type metadata :: map()

  def create(%User{} = user, metadata \\ %{}) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    absolute_expires_at = DateTime.add(now, @absolute_ttl_seconds, :second)

    attrs =
      metadata
      |> Map.take(metadata_fields())
      |> Map.merge(%{
        ref: opaque_ref("bs_"),
        public_ref: opaque_ref("bsp_"),
        user_id: user.id,
        status: :active,
        absolute_expires_at: absolute_expires_at,
        last_refreshed_at: now,
        last_seen_at: now
      })

    with {:ok, session} <- %BrowserSession{} |> BrowserSession.changeset(attrs) |> Repo.insert(),
         {:ok, token, _claims} <-
           BrowserAccess.encode(user, session.ref, absolute_expires_at, now) do
      {:ok, browser_signin_result(token, session)}
    end
  end

  def refresh(ref) when is_binary(ref) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    with {:ok, %BrowserSession{} = session} <- active_session(ref, now),
         {:ok, token, _claims} <-
           BrowserAccess.encode(
             session.user,
             session.ref,
             session.absolute_expires_at,
             now
           ),
         {:ok, session} <-
           session
           |> Ecto.Changeset.change(last_refreshed_at: now, last_seen_at: now)
           |> Repo.update() do
      {:ok, browser_signin_result(token, session)}
    end
  end

  def revoke_current(ref) when is_binary(ref), do: revoke_ref(ref, "logout")

  def revoke_other_sessions(%User{} = user, current_ref) when is_binary(current_ref) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    {count, _} =
      from(session in BrowserSession,
        where:
          session.user_id == ^user.id and session.ref != ^current_ref and
            session.status == :active
      )
      |> Repo.update_all(
        set: [status: :revoked, revoked_at: now, revoked_reason: "user_revoke_others"]
      )

    {:ok, %{count: count}}
  end

  def list_for_ref(current_ref) when is_binary(current_ref) do
    with {:ok, session} <- active_session(current_ref, DateTime.utc_now()),
         do: list(session.user, current_ref)
  end

  def revoke_other_for_ref(current_ref) when is_binary(current_ref) do
    with {:ok, session} <- active_session(current_ref, DateTime.utc_now()),
         do: revoke_other_sessions(session.user, current_ref)
  end

  def revoke_public_for_ref(current_ref, public_ref)
      when is_binary(current_ref) and is_binary(public_ref) do
    with {:ok, current} <- active_session(current_ref, DateTime.utc_now()),
         {:ok, session} <-
           BrowserSession
           |> Repo.get_by(user_id: current.user_id, public_ref: public_ref)
           |> present_session(),
         false <- session.ref == current_ref,
         {:ok, _result} <- revoke_ref(session.ref, "user_revoke") do
      {:ok, %{done: true}}
    else
      true -> {:error, :current_session}
      error -> error
    end
  end

  def list(%User{} = user, current_ref) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    sessions =
      from(session in BrowserSession,
        where:
          session.user_id == ^user.id and session.status == :active and
            session.absolute_expires_at > ^now,
        order_by: [desc: session.last_seen_at, desc: session.inserted_at]
      )
      |> Repo.all()
      |> Enum.map(&Map.put(&1, :is_current, &1.ref == current_ref))

    {:ok, sessions}
  end

  defp active_session(ref, now) do
    BrowserSession
    |> where([session], session.ref == ^ref)
    |> preload(:user)
    |> Repo.one()
    |> case do
      %BrowserSession{status: :revoked} ->
        {:error, :session_revoked}

      %BrowserSession{absolute_expires_at: expires_at} = session ->
        if DateTime.compare(expires_at, now) == :gt,
          do: {:ok, session},
          else: {:error, :session_expired}

      nil ->
        {:error, :session_not_found}
    end
  end

  defp revoke_ref(ref, reason) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    from(session in BrowserSession, where: session.ref == ^ref and session.status == :active)
    |> Repo.update_all(set: [status: :revoked, revoked_at: now, revoked_reason: reason])
    |> case do
      {1, _} -> {:ok, :revoked}
      _ -> {:ok, :already_revoked}
    end
  end

  defp browser_signin_result(token, session) do
    %{
      access_expires_at: BrowserAccess.expires_at(session.absolute_expires_at),
      access_token: token,
      browser_session_ref: session.ref,
      session_absolute_expires_at: session.absolute_expires_at
    }
  end

  defp present_session(nil), do: {:error, :session_not_found}
  defp present_session(session), do: {:ok, session}

  defp metadata_fields do
    ~w(
      browser_family os_family device_family user_agent_summary
      created_country created_region created_city
      last_seen_country last_seen_region last_seen_city
    )a
  end

  defp opaque_ref(prefix) do
    encoded = :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)
    prefix <> encoded
  end
end
