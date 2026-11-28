defmodule GroupherServer.LocalTestActors do
  @moduledoc """
  Development-only test identities with resource-scoped, real Passport facts.

      private local command -> DB guard -> run lock -> Accounts / CMS Commands

  Synthetic OAuth bindings own run/alias provenance. Normal OAuth cannot select
  these bindings. No fixture tables or production authorization exceptions exist.
  """
  alias GroupherServer.{Accounts, Repo}
  alias Accounts.Model.BrowserSession
  alias Accounts.Profiles.BrowserSessions
  alias GroupherServer.LocalTestActors.{Communities, Grants}
  alias GroupherServer.Seed.Run
  alias GroupherServer.Seed.Target, as: Guard
  alias GroupherServer.Seed.Article.Create, as: Articles
  alias GroupherServer.Seed.Cleanup.Run, as: Cleanup
  alias Helper.ORM.AdvisoryLock

  def execute(%{"run" => run, "command" => command} = input) do
    with {:ok, :pass} <- Guard.admit(),
         true <- Run.valid_name?(run) do
      previous = Logger.get_process_level(self())
      Logger.put_process_level(self(), :info)

      try do
        case {command, input["apply"]} do
          {"home.prepare", _} ->
            GroupherServer.Seed.Home.Prepare.run()

          {"actor.clean", true} when is_map_key(input, "retain-unconfirmed") ->
            Cleanup.retain_unconfirmed(run, input["retain-unconfirmed"], input["reason"])

          {"actor.clean", true} ->
            Cleanup.apply(run)

          {"actor.clean", _} ->
            Cleanup.report(run)

          _ ->
            result =
              Repo.transact_result(fn ->
                with {:ok, :acquired} <- AdvisoryLock.acquire!("local-test-actors:#{run}"),
                     {:ok, :pass} <- require_open_run(command, run) do
                  dispatch(command, run, input)
                end
              end)

            if command == "community.create" do
              GroupherServer.Seed.Community.Create.resolve_slug_conflict(result, input)
            else
              result
            end
        end
      after
        if previous do
          Logger.put_process_level(self(), previous)
        else
          Logger.delete_process_level(self())
        end
      end
    else
      false -> {:error, :invalid_local_test_name}
      {:error, _} = error -> error
    end
  end

  def execute(_), do: {:error, :invalid_local_test_command}

  defp require_open_run(command, run)
       when command in [
              "actor.create",
              "actor.grant",
              "actor.login",
              "community.create",
              "community.request-destroy",
              "article.prepare",
              "article.begin",
              "article.record",
              "admin.invite",
              "admin.accept",
              "admin.set-permissions",
              "admin.remove",
              "case.theme-edit-permission",
              "case.admin-invitation-pending",
              "case.admin-invitation-accepted"
            ] do
    if Enum.any?(Run.bindings(run), &(&1.raw["status"] != "active")) do
      {:error, :local_test_run_closed}
    else
      {:ok, :pass}
    end
  end

  defp require_open_run(_, _), do: {:ok, :pass}

  defp dispatch("actor.create", run, input), do: GroupherServer.Seed.Actor.Create.run(run, input)

  defp dispatch("actor.list", run, _) do
    Run.bindings(run)
    |> Enum.reduce_while({:ok, []}, fn binding, {:ok, actors} ->
      result =
        with {:ok, user} <- Accounts.front_desk_fresh_user(binding.user_id),
             {:ok, memberships} <- Communities.memberships(user) do
          {:ok, Map.put(Run.present(user, binding), :communities, memberships)}
        end

      case result do
        {:ok, actor} -> {:cont, {:ok, [actor | actors]}}
        {:error, _} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, actors} -> {:ok, Enum.reverse(actors)}
      {:error, _} = error -> error
    end
  end

  defp dispatch("community.create", run, input),
    do: GroupherServer.Seed.Community.Create.run(run, input)

  defp dispatch("community.request-destroy", run, input),
    do: GroupherServer.Seed.Community.RequestDestroy.run(run, input)

  defp dispatch("article.prepare", run, input), do: Articles.prepare_client(run, input)
  defp dispatch("article.begin", run, input), do: Articles.begin_dispatch(run, input)
  defp dispatch("article.record", run, input), do: Articles.record(run, input)
  defp dispatch("actor.grant", run, input), do: Grants.configure(run, input)
  defp dispatch("admin.invite", run, input), do: GroupherServer.Seed.Admin.Invite.run(run, input)
  defp dispatch("admin.accept", run, input), do: GroupherServer.Seed.Admin.Accept.run(run, input)

  defp dispatch("admin.set-permissions", run, input),
    do: GroupherServer.Seed.Admin.SetPermissions.run(run, input)

  defp dispatch("admin.remove", run, input),
    do: GroupherServer.Seed.Admin.Remove.run(run, input)

  defp dispatch("case.theme-edit-permission", run, input),
    do: GroupherServer.Seed.Cases.ThemeEditPermission.run(run, input)

  defp dispatch("case.admin-invitation-pending", run, input),
    do: GroupherServer.Seed.Cases.AdminInvitation.run(run, input, :pending)

  defp dispatch("case.admin-invitation-accepted", run, input),
    do: GroupherServer.Seed.Cases.AdminInvitation.run(run, input, :accepted)

  defp dispatch("actor.check", run, %{"alias" => name, "community" => slug} = input) do
    with {:ok, user, binding} <- Run.actor(run, name),
         {:ok, community, member} <- target(user, slug, input) do
      {:ok, Map.merge(Run.present(user, binding), %{community: community.slug, admin: member})}
    end
  end

  defp dispatch("actor.login", run, %{"alias" => name, "community" => slug} = input) do
    with {:ok, user, _} <- Run.actor(run, name),
         {:ok, _, _} <- target(user, slug, input),
         {:ok, session} <-
           BrowserSessions.create_until(
             user,
             %{
               user_agent_summary:
                 String.slice(to_string(input["userAgent"] || "Local test"), 0, 255)
             },
             DateTime.add(DateTime.utc_now(:second), 8 * 60 * 60)
           ) do
      {:ok,
       %{
         login: user.login,
         accessToken: session.access_token,
         accessExpiresAt: session.access_expires_at,
         browserSessionRef: session.browser_session_ref,
         sessionAbsoluteExpiresAt: session.session_absolute_expires_at
       }}
    end
  end

  defp dispatch("actor.revoke", run, %{"sessionRef" => ref, "alias" => name})
       when is_binary(ref) do
    with {:ok, user, _} <- Run.actor(run, name),
         %BrowserSession{} <- Repo.get_by(BrowserSession, ref: ref, user_id: user.id) do
      BrowserSessions.revoke_current(ref)
    else
      _ -> {:error, :local_test_session_unavailable}
    end
  end

  defp dispatch("actor.close", run, _), do: close_run(run)

  defp dispatch(_, _, _), do: {:error, :invalid_local_test_command}

  @doc "Seals registered identities under the caller's transaction; preserves account history."
  def close_run(run) do
    {:ok, :acquired} = AdvisoryLock.acquire!("local-test-actors:#{run}")
    rows = Run.bindings(run)

    if Enum.any?(Articles.retained(rows), &Articles.unresolved?/1) do
      {:error, :local_test_article_pending}
    else
      result =
        Enum.reduce_while(rows, {:ok, :pass}, fn binding, _ ->
          result =
            with {:ok, user} <- Accounts.front_desk_fresh_user(binding.user_id),
                 {:ok, _} <- BrowserSessions.revoke_other_sessions(user, "local-test-close"),
                 {:ok, _} <-
                   binding
                   |> Ecto.Changeset.change(
                     raw: binding.raw |> Articles.cancel_unsent() |> Map.put("status", "closed")
                   )
                   |> Repo.update() do
              {:ok, :pass}
            end

          case result do
            {:ok, _} -> {:cont, result}
            {:error, _} -> {:halt, result}
          end
        end)

      case result do
        {:ok, :pass} -> {:ok, %{status: "closed", actors: length(rows)}}
        {:error, _} = error -> error
      end
    end
  end

  @doc "Persists a completed cleanup only after the run has been sealed."
  def mark_cleanup_complete(run, report) when is_map(report) do
    Repo.transact_result(fn ->
      with {:ok, :acquired} <- AdvisoryLock.acquire!("local-test-actors:#{run}") do
        rows = Run.bindings(run)

        if rows != [] and Enum.all?(rows, &(&1.raw["status"] == "closed")) do
          Enum.reduce_while(rows, {:ok, :pass}, fn binding, _ ->
            raw =
              binding.raw
              |> Map.put("cleanup_status", "cleaned")
              |> Map.put("cleanup_report", report)

            case binding
                 |> Ecto.Changeset.change(raw: raw)
                 |> Repo.update() do
              {:ok, _} -> {:cont, {:ok, :pass}}
              {:error, reason} -> {:halt, {:error, reason}}
            end
          end)
        else
          {:error, :local_test_run_not_closed}
        end
      end
    end)
  end

  defp target(user, slug, %{"app" => "community"}) do
    with %GroupherServer.CMS.Model.Community{} = community <-
           Repo.get_by(GroupherServer.CMS.Model.Community, slug: slug),
         {:ok, _} <- GroupherServer.CMS.gate_access_check(user, :read, community) do
      {:ok, community, nil}
    else
      _ -> {:error, :community_not_found}
    end
  end

  defp target(user, slug, input) when not is_map_key(input, "app"),
    do: Communities.require_admin(user, slug)

  defp target(user, slug, %{"app" => "dash"}), do: Communities.require_admin(user, slug)
  defp target(_, _, _), do: {:error, :invalid_local_test_app}
end
