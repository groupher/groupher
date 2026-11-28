defmodule GroupherServer.Test.Accounts.OauthConcurrency do
  use ExUnit.Case, async: false

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{Accounts, Repo}
  alias Accounts.Model.{OauthProvider, User}
  alias Accounts.Profiles.{OauthFlows, OauthLinks}

  setup do
    if System.get_env("TEST_OAUTH_ISOLATED") == "1" do
      database = Repo.config()[:database]

      unless is_binary(database) and database == System.get_env("TEST_DB_NAME") and
               String.contains?(database, "oauth") do
        raise "OAuth concurrency tests require an explicitly named isolated OAuth test database"
      end
    end

    :ok
  end

  @tag skip: System.get_env("TEST_OAUTH_ISOLATED") != "1"
  @tag timeout: 60_000
  test "simultaneous creation of the same registration reference returns one flow" do
    Sandbox.unboxed_run(Repo, fn ->
      suffix = System.unique_integer([:positive]) |> Integer.to_string()
      ref = "same-flow-#{suffix}"

      provider = %{
        provider: "linuxdo",
        provider_id: "same-id-#{suffix}",
        login: "same_user_#{suffix}"
      }

      parent = self()

      tasks =
        for _ <- 1..2 do
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, {:flow_ready, self()})

              receive do
                :go -> OauthFlows.create_registration(ref, provider, nil)
              end
            end)
          end)
        end

      Enum.each(tasks, fn _ -> assert_receive {:flow_ready, _}, 5_000 end)
      Enum.each(tasks, &send(&1.pid, :go))
      results = Enum.map(tasks, &Task.await(&1, 15_000))
      assert [{:ok, first}, {:ok, second}] = results
      assert first.id == second.id
      assert first.expires_at == second.expires_at
    end)
  end

  @tag skip: System.get_env("TEST_OAUTH_ISOLATED") != "1"
  @tag timeout: 60_000
  test "competing registrations for one login can retry with a different name" do
    Sandbox.unboxed_run(Repo, fn ->
      suffix = System.unique_integer([:positive]) |> Integer.to_string()
      login = "oauth_race_#{suffix}"
      refs = ["oauth_race_a_#{suffix}", "oauth_race_b_#{suffix}"]
      provider_ids = ["oauth-race-a-#{suffix}", "oauth-race-b-#{suffix}"]

      Enum.zip(refs, provider_ids)
      |> Enum.each(fn {ref, provider_id} ->
        provider = %{provider: "linuxdo", provider_id: provider_id, login: login}
        assert {:ok, _} = OauthFlows.create_registration(ref, provider, nil)
      end)

      parent = self()

      tasks =
        Enum.map(refs, fn ref ->
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, {:ready, self()})

              receive do
                :go -> {ref, OauthFlows.complete_registration(ref, login, %{})}
              end
            end)
          end)
        end)

      Enum.each(tasks, fn _ -> assert_receive {:ready, _}, 5_000 end)
      Enum.each(tasks, &send(&1.pid, :go))
      results = Enum.map(tasks, &Task.await(&1, 15_000))
      assert Enum.count(results, fn {_, result} -> match?({:ok, _}, result) end) == 1

      assert [{loser, {:error, :login_unavailable}}] =
               Enum.filter(results, fn {_, result} -> match?({:error, _}, result) end)

      assert {:ok, _} = OauthFlows.complete_registration(loser, "other_#{suffix}", %{})

      assert {:error, :invalid_oauth_flow} =
               OauthFlows.complete_registration(loser, "again_#{suffix}", %{})

      assert Enum.count(
               provider_ids,
               &(not is_nil(Repo.get_by(OauthProvider, provider: "linuxdo", provider_id: &1)))
             ) == 2
    end)
  end

  @tag skip: System.get_env("TEST_OAUTH_ISOLATED") != "1"
  @tag timeout: 60_000
  test "simultaneous callback claims consume one exchange opportunity" do
    Sandbox.unboxed_run(Repo, fn ->
      suffix = System.unique_integer([:positive]) |> Integer.to_string()
      provider_id = "claim-owner-#{suffix}"
      login = "claim_owner_#{suffix}"

      assert {:ok, _} =
               OauthFlows.create_registration(
                 "claim-reg-#{suffix}",
                 %{provider: "github", provider_id: provider_id, login: login},
                 nil
               )

      assert {:ok, session} = OauthFlows.complete_registration("claim-reg-#{suffix}", login, %{})
      binding = Repo.get_by!(OauthProvider, provider: "github", provider_id: provider_id)
      user = Repo.get!(User, binding.user_id)
      ref = "claim-link-#{suffix}"

      attrs = %{
        ref: ref,
        provider: "linuxdo",
        browser_session_ref: session.browser_session_ref,
        code_verifier: "verifier",
        nonce: "nonce",
        return_to: "https://dash.groupher.localhost/"
      }

      assert {:ok, _} = OauthLinks.start(user, attrs)

      parent = self()

      tasks =
        for _ <- 1..2 do
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, {:claim_ready, self()})

              receive do
                :go ->
                  OauthLinks.claim(user, ref, session.browser_session_ref, "linuxdo", "nonce")
              end
            end)
          end)
        end

      Enum.each(tasks, fn _ -> assert_receive {:claim_ready, _}, 5_000 end)
      Enum.each(tasks, &send(&1.pid, :go))
      results = Enum.map(tasks, &Task.await(&1, 15_000))
      assert Enum.count(results, &match?({:ok, %{code_verifier: "verifier"}}, &1)) == 1
      assert Enum.count(results, &match?({:error, :invalid_oauth_flow}, &1)) == 1
    end)
  end

  @tag skip: System.get_env("TEST_OAUTH_ISOLATED") != "1"
  @tag timeout: 60_000
  test "concurrent unlinks retain a usable login method" do
    Sandbox.unboxed_run(Repo, fn ->
      suffix = System.unique_integer([:positive]) |> Integer.to_string()
      login = "unlink_race_#{suffix}"
      github_id = "unlink-github-#{suffix}"
      linux_id = "unlink-linux-#{suffix}"

      assert {:ok, _} =
               OauthFlows.create_registration(
                 "unlink-reg-#{suffix}",
                 %{provider: "github", provider_id: github_id, login: login},
                 nil
               )

      assert {:ok, session} = OauthFlows.complete_registration("unlink-reg-#{suffix}", login, %{})
      github = Repo.get_by!(OauthProvider, provider: "github", provider_id: github_id)
      user = Repo.get!(User, github.user_id)
      ref = "unlink-link-#{suffix}"

      attrs = %{
        ref: ref,
        provider: "linuxdo",
        browser_session_ref: session.browser_session_ref,
        code_verifier: "verifier",
        nonce: "nonce",
        return_to: "https://dash.groupher.localhost/"
      }

      assert {:ok, _} = OauthLinks.start(user, attrs)

      assert {:ok, _} =
               OauthLinks.claim(user, ref, session.browser_session_ref, "linuxdo", "nonce")

      assert {:ok, _} =
               OauthLinks.verified(user, ref, session.browser_session_ref, %{
                 provider: "linuxdo",
                 provider_id: linux_id,
                 login: login
               })

      assert {:ok, _} =
               OauthLinks.confirm(user, ref, session.browser_session_ref, "linuxdo", linux_id)

      linux = Repo.get_by!(OauthProvider, provider: "linuxdo", provider_id: linux_id)
      parent = self()

      tasks =
        Enum.map([github.public_ref, linux.public_ref], fn public_ref ->
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, {:unlink_ready, self()})

              receive do
                :go -> Accounts.Profiles.unlink_oauth_identity(login, public_ref)
              end
            end)
          end)
        end)

      Enum.each(tasks, fn _ -> assert_receive {:unlink_ready, _}, 5_000 end)
      Enum.each(tasks, &send(&1.pid, :go))
      results = Enum.map(tasks, &Task.await(&1, 15_000))
      assert Enum.count(results, &match?({:ok, _}, &1)) == 1
      assert Enum.count(results, &match?({:error, _}, &1)) == 1
      remaining = Enum.filter([github.id, linux.id], &(not is_nil(Repo.get(OauthProvider, &1))))
      assert length(remaining) == 1
    end)
  end

  @tag skip: System.get_env("TEST_OAUTH_ISOLATED") != "1"
  @tag timeout: 60_000
  test "simultaneous confirmations create one binding" do
    Sandbox.unboxed_run(Repo, fn ->
      suffix = System.unique_integer([:positive]) |> Integer.to_string()
      login = "confirm_race_#{suffix}"
      github_id = "confirm-github-#{suffix}"
      linux_id = "confirm-linux-#{suffix}"

      assert {:ok, _} =
               OauthFlows.create_registration(
                 "confirm-reg-#{suffix}",
                 %{provider: "github", provider_id: github_id, login: login},
                 nil
               )

      assert {:ok, session} =
               OauthFlows.complete_registration("confirm-reg-#{suffix}", login, %{})

      github = Repo.get_by!(OauthProvider, provider: "github", provider_id: github_id)
      user = Repo.get!(User, github.user_id)
      ref = "confirm-link-#{suffix}"

      attrs = %{
        ref: ref,
        provider: "linuxdo",
        browser_session_ref: session.browser_session_ref,
        code_verifier: "verifier",
        nonce: "nonce",
        return_to: "https://dash.groupher.localhost/"
      }

      assert {:ok, _} = OauthLinks.start(user, attrs)

      assert {:ok, _} =
               OauthLinks.claim(user, ref, session.browser_session_ref, "linuxdo", "nonce")

      assert {:ok, _} =
               OauthLinks.verified(user, ref, session.browser_session_ref, %{
                 provider: "linuxdo",
                 provider_id: linux_id,
                 login: login
               })

      parent = self()

      tasks =
        for _ <- 1..2 do
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              send(parent, {:confirm_ready, self()})

              receive do
                :go ->
                  OauthLinks.confirm(user, ref, session.browser_session_ref, "linuxdo", linux_id)
              end
            end)
          end)
        end

      Enum.each(tasks, fn _ -> assert_receive {:confirm_ready, _}, 5_000 end)
      Enum.each(tasks, &send(&1.pid, :go))
      results = Enum.map(tasks, &Task.await(&1, 15_000))
      assert Enum.count(results, &match?({:ok, _}, &1)) == 1
      assert Enum.count(results, &match?({:error, :invalid_oauth_flow}, &1)) == 1

      assert Repo.get_by!(OauthProvider, provider: "linuxdo", provider_id: linux_id).user_id ==
               user.id
    end)
  end
end
