defmodule GroupherServer.CMS.ProductionSeed.Logins do
  @moduledoc """
  Single-use Auth redemption and bounded official Phoenix BrowserSessions.

      Operator issue -> hashed credential -> Auth-only mutation -> locked consume
                     -> official BrowserSession -> Auth signs both Cookies

  Failure rolls back consumption; Auth cookie failure compensates via revoke.
  Closing a run revokes its sessions and makes every unused credential unusable.
  """
  import Ecto.Query
  alias GroupherServer.CMS
  alias CMS.ProductionSeed
  alias GroupherServer.{Repo, Accounts}
  alias ProductionSeed.{Run, LoginGrant}
  alias Accounts.Model.{User, OauthProvider}

  @doc "Issues a five-minute credential for a fixed alias; only this result contains plaintext."
  def issue(run_id, name, database) do
    with {:ok, _} <- ProductionSeed.admit(database) do
      Repo.transaction(fn ->
        run = ProductionSeed.lock!(run_id)
        user_id = run.manifest["users"][name] || Repo.rollback(:seed_unknown_alias)
        secret = "psl_" <> Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)

        expires =
          Enum.min_by(
            [DateTime.add(DateTime.utc_now(:second), 300), run.expires_at],
            &DateTime.to_unix/1
          )

        Repo.insert!(%LoginGrant{
          run_id: run.id,
          user_id: user_id,
          digest: digest(secret),
          expires_at: expires
        })

        %{credential: secret, expires_at: DateTime.to_iso8601(expires)}
      end)
    end
  end

  @doc "Atomically consumes a credential and returns a normal, run-bounded sign-in payload."
  def redeem(secret, metadata \\ %{})

  def redeem(secret, metadata) when is_binary(secret) and byte_size(secret) <= 128 do
    with true <- System.get_env("PRODUCTION_SEED_ENABLED") == "true" do
      Repo.transaction(fn ->
        grant =
          Repo.get_by(LoginGrant, digest: digest(secret)) ||
            Repo.rollback(:seed_invalid_credential)

        run = Repo.get!(Run, grant.run_id) |> then(&ProductionSeed.lock!(&1.run_id))
        grant = Repo.one!(from(g in LoginGrant, where: g.id == ^grant.id, lock: "FOR UPDATE"))

        if grant.consumed_at || DateTime.compare(grant.expires_at, DateTime.utc_now()) != :gt do
          Repo.rollback(:seed_invalid_credential)
        end

        unless grant.user_id in Map.values(run.manifest["users"]) do
          Repo.rollback(:seed_invalid_credential)
        end

        {:ok, _} = ProductionSeed.admit(run.database_name)

        if Repo.exists?(from(o in OauthProvider, where: o.user_id == ^grant.user_id)) do
          Repo.rollback(:seed_unexpected_oauth)
        end

        result =
          case Accounts.profiles_create_bounded_browser_session(
                 Repo.get!(User, grant.user_id),
                 metadata,
                 run.expires_at
               ) do
            {:ok, session} -> session
            {:error, reason} -> Repo.rollback(reason)
          end

        grant
        |> Ecto.Changeset.change(
          consumed_at: DateTime.utc_now(:second),
          session_ref: result.browser_session_ref
        )
        |> Repo.update!()

        result
      end)
    else
      false -> {:error, :seed_disabled}
    end
  end

  def redeem(_, _), do: {:error, :seed_invalid_credential}

  @doc "Closes a window, including expired windows, and revokes all issued sessions idempotently."
  def close(run_id, database) do
    with {:ok, _} <- ProductionSeed.admit(database) do
      Repo.transaction(fn ->
        run = ProductionSeed.lock!(run_id, false)

        refs =
          Repo.all(
            from(g in LoginGrant,
              where: g.run_id == ^run.id and not is_nil(g.session_ref),
              select: g.session_ref
            )
          )

        Enum.each(refs, fn ref ->
          {:ok, _} = Accounts.profiles_revoke_seed_browser_session(ref)
        end)

        run |> Ecto.Changeset.change(status: "closed") |> Repo.update!()
        %{status: "closed", session_count: length(refs)}
      end)
    end
  end

  defp digest(secret), do: :crypto.hash(:sha256, secret)
end
