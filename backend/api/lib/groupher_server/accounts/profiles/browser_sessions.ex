defmodule GroupherServer.Accounts.Profiles.BrowserSessions do
  @moduledoc """
  Browser Session lifecycle for trusted Auth-to-Phoenix operations.

      OAuth identity -> persisted Session -> 30-minute browser access token
      refresh/logout/revoke -> ownership and absolute-expiry checks here

  Browser clients never call this module through regular browser GraphQL; Auth
  holds the internal ref and invokes its trusted GraphQL operations.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, Repo}

  alias Accounts.Model.{BrowserSession, User}
  alias Accounts.Profiles.ErrorCat
  alias Helper.Guardian.BrowserAccess

  @absolute_ttl_seconds 90 * 24 * 60 * 60
  @user_agent_summary_max_length 255

  @type metadata :: map()

  @doc """
  Creates a browser session and returns its access token payload.

  ## Examples

      Accounts.Profiles.BrowserSessions.create(user, %{user_agent_summary: "Safari"})
  """
  @spec create(User.t(), metadata()) :: {:ok, map()} | {:error, term()}
  def create(%User{} = user, metadata \\ %{}) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    absolute_expires_at = DateTime.add(now, @absolute_ttl_seconds, :second)

    attrs =
      metadata
      |> Map.take(metadata_fields())
      |> normalize_metadata()
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

  @doc """
  Creates an official BrowserSession bounded by an earlier operational deadline.

      trusted caller -> bounded create -> persisted expiry -> normal access token

  ## Examples

      BrowserSessions.create_until(user, %{}, DateTime.add(DateTime.utc_now(:second), 300))
      #=> {:ok, signin_result} | {:error, reason}
  """
  def create_until(%User{} = user, metadata, %DateTime{} = deadline) do
    now = DateTime.utc_now(:second)

    if DateTime.compare(deadline, now) == :gt and
         DateTime.diff(deadline, now) <= @absolute_ttl_seconds do
      Repo.transact_result(fn ->
        with {:ok, result} <- create(user, metadata),
             session <- Repo.get_by!(BrowserSession, ref: result.browser_session_ref),
             {:ok, _} <-
               session
               |> Ecto.Changeset.change(absolute_expires_at: DateTime.truncate(deadline, :second))
               |> Repo.update(),
             {:ok, bounded} <- refresh(result.browser_session_ref) do
          {:ok, bounded}
        end
      end)
    else
      {:error, :invalid_browser_session_deadline}
    end
  end

  @doc """
  Refreshes an active browser session token.

  ## Examples

      Accounts.Profiles.BrowserSessions.refresh(session_ref)
  """
  @spec refresh(String.t()) :: {:ok, map()} | {:error, term()}
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

  @doc """
  Revokes the browser session used for the current logout operation.

  ## Examples

      Accounts.Profiles.BrowserSessions.revoke_current(session_ref)
  """
  @spec revoke_current(String.t()) :: {:ok, atom()} | {:error, term()}
  def revoke_current(ref) when is_binary(ref), do: revoke_ref(ref, "logout")

  @doc """
  Revokes every active browser session except the current one.

  ## Examples

      Accounts.Profiles.BrowserSessions.revoke_other_sessions(user, session_ref)
  """
  @spec revoke_other_sessions(User.t(), String.t()) :: {:ok, map()}
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

  @doc """
  Lists sessions owned by the account behind an active session reference.

  ## Examples

      Accounts.Profiles.BrowserSessions.list_for_ref(session_ref, nil)
  """
  @spec list_for_ref(String.t(), term()) :: {:ok, struct()} | {:error, term()}
  def list_for_ref(current_ref, pagi) when is_binary(current_ref) do
    with {:ok, session} <- active_session(current_ref, DateTime.utc_now()) do
      list(session.user, current_ref, pagi)
    end
  end

  @doc """
  Checks that a browser access token still points to an active owned session.

  ## Examples

      Accounts.Profiles.BrowserSessions.active_for_user?(user.id, session_ref)
  """
  def active_for_user?(user_id, ref) when is_integer(user_id) and is_binary(ref) do
    now = DateTime.utc_now()

    from(session in BrowserSession,
      where:
        session.user_id == ^user_id and session.ref == ^ref and session.status == :active and
          session.absolute_expires_at > ^now
    )
    |> Repo.exists?()
  end

  def active_for_user?(_user_id, _ref), do: false

  @doc """
  Revokes all sessions except the active session behind a public reference.

  ## Examples

      Accounts.Profiles.BrowserSessions.revoke_other_for_ref(session_ref)
  """
  @spec revoke_other_for_ref(String.t()) :: {:ok, map()} | {:error, term()}
  def revoke_other_for_ref(current_ref) when is_binary(current_ref) do
    with {:ok, session} <- active_session(current_ref, DateTime.utc_now()) do
      revoke_other_sessions(session.user, current_ref)
    end
  end

  @doc """
  Revokes one other session by its public reference.

  ## Examples

      Accounts.Profiles.BrowserSessions.revoke_public_for_ref(session_ref, public_ref)
  """
  @spec revoke_public_for_ref(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
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
      true -> {:error, ErrorCat.current_session()}
      error -> error
    end
  end

  @doc """
  Lists active browser sessions and marks the current one.

  ## Examples

      Accounts.Profiles.BrowserSessions.list(user, session_ref, nil)
  """
  @spec list(User.t(), String.t(), GroupherServer.Pagi.Params.input()) :: tuple()
  def list(%User{} = user, current_ref, pagi) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    query =
      from(session in BrowserSession,
        where:
          session.user_id == ^user.id and session.status == :active and
            session.absolute_expires_at > ^now
      )

    with {:ok, page} <-
           Helper.ORM.pagi(query, pagi,
             for: BrowserSession,
             surface: "accounts.browser_sessions",
             query_fingerprint: to_string(user.id),
             order: %Helper.ORM.Pagi.Order{
               fields: [:last_seen_at, :id],
               directions: [:desc_nulls_last, :desc],
               cursor_fields: [:last_seen_at, :id]
             }
           ) do
      {:ok,
       %{page | entries: Enum.map(page.entries, &Map.put(&1, :is_current, &1.ref == current_ref))}}
    end
  end

  defp active_session(ref, now) do
    BrowserSession
    |> where([session], session.ref == ^ref)
    |> preload(:user)
    |> Repo.one()
    |> case do
      %BrowserSession{status: :revoked} ->
        {:error, ErrorCat.session_revoked()}

      %BrowserSession{absolute_expires_at: expires_at} = session ->
        if DateTime.compare(expires_at, now) == :gt do
          {:ok, session}
        else
          {:error, ErrorCat.session_expired()}
        end

      nil ->
        {:error, ErrorCat.session_not_found()}
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

  defp present_session(nil), do: {:error, ErrorCat.session_not_found()}
  defp present_session(session), do: {:ok, session}

  defp metadata_fields do
    ~w(
      browser_family os_family device_family user_agent_summary
      created_country created_region created_city
      last_seen_country last_seen_region last_seen_city
    )a
  end

  defp normalize_metadata(metadata) do
    Map.update(metadata, :user_agent_summary, nil, fn value ->
      if is_binary(value), do: String.slice(value, 0, @user_agent_summary_max_length), else: value
    end)
  end

  defp opaque_ref(prefix) do
    encoded = :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)
    prefix <> encoded
  end
end
