defmodule GroupherServer.Test.Accounts.Oauth do
  @moduledoc false

  use GroupherServer.TestMate
  import Helper.Utils

  alias GroupherServer.Accounts
  alias Accounts.Model.{BrowserSession, OauthProvider}

  # @valid_user mock_attrs(:user)
  @valid_github_profile mock_attrs(:oauth_profile, %{provider: "github"}) |> map_key_stringify
  @valid_linuxdo_profile mock_attrs(:oauth_profile, %{provider: "linuxdo"}) |> map_key_stringify

  defp signin(provider, metadata \\ %{}) do
    ref = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)
    Accounts.Profiles.signin_oauth(provider, metadata, ref, nil)
  end

  defp binding_count(provider) do
    provider_name = provider["provider"]
    provider_id = provider["provider_id"]

    Repo.aggregate(
      from(binding in OauthProvider,
        where: binding.provider == ^provider_name and binding.provider_id == ^provider_id
      ),
      :count
    )
  end

  defp bindings_for_login(login) do
    user = Repo.get_by!(User, login: login)

    Repo.all(
      from(binding in OauthProvider,
        where: binding.user_id == ^user.id,
        order_by: [asc: binding.id]
      )
    )
  end

  # link oauth
  describe "[oauth login]" do
    test "can register new valid oauth github user" do
      assert {:error, _} =
               ORM.find_by(OauthProvider, %{
                 provider: "github",
                 provider_id: @valid_github_profile["provider_id"]
               })

      assert {:error, _} = ORM.find_by(User, nickname: @valid_github_profile["login"])
      assert {:error, _} = ORM.find_by(OauthProvider, login: @valid_github_profile["login"])

      {:ok, signin_res} = signin(@valid_github_profile)

      assert {:ok, user} =
               ORM.find_by(User, %{login: @valid_github_profile["login"]}, preload: :social)

      assert user.social.github == "https://github.com/#{@valid_github_profile["login"]}"

      assert {:ok, oauth_provider} =
               ORM.find_by(OauthProvider, %{login: @valid_github_profile["login"]},
                 preload: :user
               )

      assert oauth_provider.provider_id == @valid_github_profile["provider_id"]
      assert oauth_provider.provider == "github"
      assert oauth_provider.login == @valid_github_profile["login"]
      assert oauth_provider.user_id == user.id
      assert is_binary(oauth_provider.public_ref)
      assert %DateTime{} = oauth_provider.inserted_at
      assert %DateTime{} = oauth_provider.updated_at

      assert is_nil(oauth_provider.raw)

      assert signin_res.session |> Map.has_key?(:access_token)
      assert signin_res.session |> Map.has_key?(:access_expires_at)
      assert signin_res.session |> Map.has_key?(:browser_session_ref)
      assert signin_res.session |> Map.has_key?(:session_absolute_expires_at)
    end

    test "existing user can signin" do
      {:ok, signin_res} = signin(@valid_github_profile)

      assert signin_res.session |> Map.has_key?(:access_token)
      assert signin_res.session |> Map.has_key?(:browser_session_ref)
    end

    test "missing provider login requires registration" do
      profile = %{
        "provider" => "linuxdo",
        "provider_id" => "no-login",
        "login" => nil,
        "nickname" => "Linux User",
        "avatar" => nil
      }

      assert {:ok, %{status: "REGISTRATION_REQUIRED"}} = signin(profile)
      refute Repo.get_by(OauthProvider, provider: "linuxdo", provider_id: "no-login")
    end

    test "direct registration survives a post-commit session creation failure" do
      provider =
        @valid_github_profile
        |> Map.put("provider_id", "direct-session-failure")
        |> Map.put("login", "direct_session_failure")

      assert {:error, _} = signin(provider, %{browser_family: %{invalid: true}})

      binding =
        Repo.get_by!(OauthProvider, provider: "github", provider_id: "direct-session-failure")

      refute Repo.get_by(BrowserSession, user_id: binding.user_id)
      assert {:ok, %{status: "SIGNED_IN", session: session}} = signin(provider)

      assert Repo.get_by!(BrowserSession, ref: session.browser_session_ref).user_id ==
               binding.user_id
    end

    test "existing user can signin multiple times" do
      {:ok, _} = signin(@valid_github_profile)
      {:ok, _} = signin(@valid_github_profile)
      {:ok, _} = signin(@valid_github_profile)
      {:ok, _} = signin(@valid_github_profile)

      assert binding_count(@valid_github_profile) == 1
    end

    test "concurrent first sign-ins reuse the committed OAuth identity" do
      parent = self()

      tasks =
        for _ <- 1..2 do
          Task.async(fn ->
            send(parent, {:oauth_ready, self()})

            receive do
              :go -> signin(@valid_github_profile)
            end
          end)
        end

      for _ <- tasks do
        assert_receive {:oauth_ready, _pid}
      end

      Enum.each(tasks, &send(&1.pid, :go))

      results = Enum.map(tasks, &Task.await(&1, 5_000))
      assert Enum.all?(results, &match?({:ok, _}, &1))
      assert binding_count(@valid_github_profile) == 1
    end

    test "bounds browser-session user-agent metadata at the persistence boundary" do
      {:ok, signin_res} =
        signin(@valid_github_profile, %{
          user_agent_summary: String.duplicate("u", 512)
        })

      assert {:ok, session} =
               ORM.find_by(BrowserSession, ref: signin_res.session.browser_session_ref)

      assert String.length(session.user_agent_summary) == 255
    end

    test "existing non-existing user fails" do
      {:ok, _signin_res} =
        signin(@valid_github_profile)

      {:ok, %{status: "REGISTRATION_REQUIRED"}} =
        signin(%{
          @valid_github_profile
          | "provider_id" => "non-existing-id"
        })
    end

    test "can link oauth provider to existing user" do
      user_login = @valid_linuxdo_profile["login"]
      github_provider = @valid_github_profile |> Map.put("login", user_login)
      {:ok, _} = signin(github_provider)
      {:ok, res} = Accounts.Profiles.link_oauth(user_login, @valid_linuxdo_profile)

      assert res.login == user_login

      providers = bindings_for_login(user_login)
      assert length(providers) == 2

      first = providers |> List.first()
      last = providers |> List.last()

      assert first.user_id == last.user_id
      assert first.provider == "github"
      assert last.provider == "linuxdo"

      assert is_nil(last.raw)
    end

    test "cannot link a second account from the same provider" do
      user_login = @valid_linuxdo_profile["login"]
      github_provider = @valid_github_profile |> Map.put("login", user_login)
      {:ok, _} = signin(github_provider)

      second_github = Map.put(github_provider, "provider_id", "github-second-account")

      assert {:error, reason} = Accounts.Profiles.link_oauth(user_login, second_github)
      assert Enum.into(reason, %{})[:code] == "OAUTH_PROVIDER_ALREADY_LINKED"
    end

    test "concurrent users linking one identity keep a single owner" do
      {:ok, first_user} = db_insert(:user)
      {:ok, second_user} = db_insert(:user)
      parent = self()

      tasks =
        [first_user, second_user]
        |> Enum.map(fn user ->
          Task.async(fn ->
            send(parent, {:link_ready, self()})

            receive do
              :go -> Accounts.Profiles.link_oauth(user.login, @valid_linuxdo_profile)
            end
          end)
        end)

      for _ <- tasks do
        assert_receive {:link_ready, _pid}
      end

      Enum.each(tasks, &send(&1.pid, :go))
      results = Enum.map(tasks, &Task.await(&1, 5_000))

      assert Enum.count(results, &match?({:ok, _}, &1)) == 1
      assert Enum.count(results, &match?({:error, _}, &1)) == 1
      assert binding_count(@valid_linuxdo_profile) == 1

      assert Enum.any?(results, fn
               {:error, reason} ->
                 Enum.into(reason, %{})[:code] == "OAUTH_IDENTITY_ALREADY_LINKED"

               _ ->
                 false
             end)
    end

    test "can unlink oauth provider" do
      user_login = @valid_linuxdo_profile["login"]
      github_provider = @valid_github_profile |> Map.put("login", user_login)
      {:ok, _} = signin(github_provider)
      {:ok, _} = Accounts.Profiles.link_oauth(user_login, @valid_linuxdo_profile)

      providers = bindings_for_login(user_login)
      assert length(providers) == 2

      {:ok, _} = Accounts.Profiles.unlink_oauth(user_login, @valid_linuxdo_profile)

      providers = bindings_for_login(user_login)
      assert length(providers) == 1
      after_delete = providers |> List.first()

      assert after_delete.provider == "github"
    end

    test "canonical linked-account projection uses public refs" do
      user_login = @valid_linuxdo_profile["login"]
      github_provider = @valid_github_profile |> Map.put("login", user_login)
      {:ok, _} = signin(github_provider)
      {:ok, _} = Accounts.Profiles.link_oauth(user_login, @valid_linuxdo_profile)

      assert {:ok, %{entries: entries}} = Accounts.Profiles.linked_oauth_accounts(user_login)
      assert length(entries) == 2
      assert Enum.all?(entries, &(&1.can_unlink == true))

      linuxdo_binding = Enum.find(entries, &(&1.provider == "linuxdo"))

      assert {:ok, %{entries: remaining}} =
               Accounts.Profiles.unlink_oauth_identity(user_login, linuxdo_binding.public_ref)

      assert length(remaining) == 1
      assert hd(remaining).can_unlink == false
    end

    test "can not unlink oauth provider if there is only one" do
      user_login = @valid_linuxdo_profile["login"]
      github_provider = @valid_github_profile |> Map.put("login", user_login)
      {:ok, _} = signin(github_provider)

      providers = bindings_for_login(user_login)
      assert length(providers) == 1

      {:error, reason} = Accounts.Profiles.unlink_oauth(user_login, github_provider)

      assert reason |> Enum.into(%{}) |> Map.get(:code) == "OAUTH_LAST_LOGIN_METHOD"
    end
  end
end
