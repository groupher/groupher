defmodule GroupherServer.LocalTestActors do
  @moduledoc """
  Development-only test identities with resource-scoped, real Passport facts.

      private local command -> DB guard -> run lock -> Accounts / CMS Commands

  Synthetic OAuth bindings own run/alias provenance. Normal OAuth cannot select
  these bindings. No fixture tables or production authorization exceptions exist.
  """
  import Ecto.Query
  alias GroupherServer.{Accounts, Repo}
  alias Accounts.Model.{BrowserSession, OauthProvider, User}
  alias Accounts.Profiles.{BrowserSessions, Oauth}
  alias GroupherServer.LocalTestActors.{Cleanup, Communities, Grants, Guard}
  alias Helper.ORM.AdvisoryLock

  @provider "local-test-actor-v1"
  @name ~r/\A[a-z][a-z0-9-]{0,39}\z/

  def execute(%{"run" => run, "command" => command} = input) do
    with {:ok, :pass} <- Guard.admit(),
         true <- valid_name?(run) do
      previous = Logger.get_process_level(self())
      Logger.put_process_level(self(), :info)

      try do
        if command == "actor.clean" and input["apply"] == true do
          Cleanup.apply(run)
        else
          Repo.transact_result(fn ->
            with {:ok, :acquired} <- AdvisoryLock.acquire!("local-test-actors:#{run}") do
              dispatch(command, run, input)
            end
          end)
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

  def actor(run, name) do
    with true <- valid_name?(name),
         %OauthProvider{
           raw: %{"tool" => @provider, "status" => "active", "run" => ^run, "alias" => ^name}
         } = binding <-
           Repo.get_by(OauthProvider, provider: @provider, provider_id: "#{run}/#{name}"),
         %User{} = user <- Repo.get(User, binding.user_id) do
      {:ok, user, binding}
    else
      _ -> {:error, :local_test_actor_unavailable}
    end
  end

  def bindings(run) do
    Repo.all(from(o in OauthProvider, where: o.provider == @provider and o.raw["run"] == ^run))
  end

  def present(user, binding) do
    %{alias: binding.raw["alias"], login: user.login, status: binding.raw["status"]}
  end

  defp dispatch("actor.create", run, %{"alias" => name}) do
    cond do
      not valid_name?(name) ->
        {:error, :invalid_local_test_name}

      Enum.any?(bindings(run), &(&1.raw["status"] != "active")) ->
        {:error, :local_test_run_closed}

      true ->
        case actor(run, name) do
          {:ok, user, binding} -> {:ok, present(user, binding)}
          _ -> register(run, name)
        end
    end
  end

  defp dispatch("actor.list", run, _) do
    {:ok,
     Enum.map(bindings(run), fn binding ->
       user = Repo.get!(User, binding.user_id)
       Map.put(present(user, binding), :communities, Communities.memberships(user))
     end)}
  end

  defp dispatch("community.create", run, input), do: Communities.create(run, input)
  defp dispatch("actor.grant", run, input), do: Grants.configure(run, input)
  defp dispatch("actor.clean", run, _input), do: Cleanup.report(run)

  defp dispatch("actor.check", run, %{"alias" => name, "community" => slug} = input) do
    with {:ok, user, binding} <- actor(run, name),
         {:ok, community, member} <- target(user, slug, input) do
      {:ok, Map.merge(present(user, binding), %{community: community.slug, admin: member})}
    end
  end

  defp dispatch("actor.login", run, %{"alias" => name, "community" => slug} = input) do
    with {:ok, user, _} <- actor(run, name),
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
    with {:ok, user, _} <- actor(run, name),
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
    rows = bindings(run)

    Enum.each(rows, fn binding ->
      user = Repo.get!(User, binding.user_id)
      {:ok, _} = BrowserSessions.revoke_other_sessions(user, "local-test-close")

      {:ok, _} =
        binding
        |> Ecto.Changeset.change(raw: Map.put(binding.raw, "status", "closed"))
        |> Repo.update()
    end)

    {:ok, %{status: "closed", actors: length(rows)}}
  end

  defp target(user, slug, %{"app" => "community"}) do
    with %GroupherServer.CMS.Model.Community{} = community <-
           Repo.get_by(GroupherServer.CMS.Model.Community, slug: slug),
         {:ok, _} <- GroupherServer.CMS.Gate.access_check(user, :read, community) do
      {:ok, community, nil}
    else
      _ -> {:error, :community_not_found}
    end
  end

  defp target(user, slug, input) when not is_map_key(input, "app"),
    do: Communities.require_admin(user, slug)

  defp target(user, slug, %{"app" => "dash"}), do: Communities.require_admin(user, slug)
  defp target(_, _, _), do: {:error, :invalid_local_test_app}

  defp register(run, name) do
    login =
      "lt-#{String.slice(run, 0, 12)}-#{name}-#{Base.encode16(:crypto.strong_rand_bytes(6), case: :lower)}"

    with {:ok, user} <-
           Oauth.register_in_transaction(%{
             provider: @provider,
             provider_id: "#{run}/#{name}",
             login: login,
             nickname: "#{name} (#{run})"
           }),
         %OauthProvider{} = binding <-
           Repo.get_by(OauthProvider, provider: @provider, user_id: user.id),
         {:ok, binding} <-
           binding
           |> Ecto.Changeset.change(
             raw: %{
               "tool" => @provider,
               "run" => run,
               "alias" => name,
               "status" => "active",
               "communities" => []
             }
           )
           |> Repo.update() do
      {:ok, present(user, binding)}
    else
      {:error, _} = error -> error
      _ -> {:error, :local_test_registration_failed}
    end
  end

  defp valid_name?(name), do: is_binary(name) and Regex.match?(@name, name)
end
