defmodule GroupherServer.Test.Accounts.Oauth do
  @moduledoc false

  use GroupherServer.TestMate
  import Helper.Utils

  alias GroupherServer.Accounts.Model.{BrowserSession, OauthProvider}

  # @valid_user mock_attrs(:user)
  @valid_github_profile mock_attrs(:oauth_profile, %{provider: "github"}) |> map_key_stringify
  @valid_twitter_profile mock_attrs(:oauth_profile, %{provider: "twitter"}) |> map_key_stringify

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

      {:ok, signin_res} = Accounts.Profiles.signin_oauth(@valid_github_profile)

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

      assert signin_res |> Map.has_key?(:access_token)
      assert signin_res |> Map.has_key?(:access_expires_at)
      assert signin_res |> Map.has_key?(:browser_session_ref)
      assert signin_res |> Map.has_key?(:session_absolute_expires_at)
    end

    test "existing user can signin" do
      {:ok, signin_res} = Accounts.Profiles.signin_oauth(@valid_github_profile)

      assert signin_res |> Map.has_key?(:access_token)
      assert signin_res |> Map.has_key?(:browser_session_ref)
    end

    test "provider login and avatar are optional" do
      profile = %{
        "provider" => "google",
        "provider_id" => "google-account-without-login",
        "login" => nil,
        "nickname" => "Google User",
        "avatar" => nil,
        "email" => "google-user@example.com"
      }

      assert {:ok, _signin_res} = Accounts.Profiles.signin_oauth(profile)

      assert {:ok, oauth_provider} =
               ORM.find_by(OauthProvider, provider: "google", provider_id: profile["provider_id"])

      assert is_nil(oauth_provider.login)
      assert is_nil(oauth_provider.avatar)
    end

    test "existing user can signin multiple times" do
      {:ok, _} = Accounts.Profiles.signin_oauth(@valid_github_profile)
      {:ok, _} = Accounts.Profiles.signin_oauth(@valid_github_profile)
      {:ok, _} = Accounts.Profiles.signin_oauth(@valid_github_profile)
      {:ok, _} = Accounts.Profiles.signin_oauth(@valid_github_profile)

      assert {:ok, 1} == ORM.count(OauthProvider)
    end

    test "concurrent first sign-ins reuse the committed OAuth identity" do
      parent = self()

      tasks =
        for _ <- 1..2 do
          Task.async(fn ->
            send(parent, {:oauth_ready, self()})

            receive do
              :go -> Accounts.Profiles.signin_oauth(@valid_github_profile)
            end
          end)
        end

      for _ <- tasks do
        assert_receive {:oauth_ready, _pid}
      end

      Enum.each(tasks, &send(&1.pid, :go))

      results = Enum.map(tasks, &Task.await(&1, 5_000))
      assert Enum.all?(results, &match?({:ok, _}, &1))
      assert {:ok, 1} == ORM.count(OauthProvider)
    end

    test "bounds browser-session user-agent metadata at the persistence boundary" do
      {:ok, signin_res} =
        Accounts.Profiles.signin_oauth(@valid_github_profile, %{
          user_agent_summary: String.duplicate("u", 512)
        })

      assert {:ok, session} = ORM.find_by(BrowserSession, ref: signin_res.browser_session_ref)
      assert String.length(session.user_agent_summary) == 255
    end

    test "existing non-existing user fails" do
      {:ok, _signin_res} =
        Accounts.Profiles.signin_oauth(@valid_github_profile)

      {:error, _res} =
        Accounts.Profiles.signin_oauth(%{
          @valid_github_profile
          | "provider_id" => "non-existing-id"
        })
    end

    test "can link oauth provider to existing user" do
      user_login = @valid_twitter_profile["login"]
      github_provider = @valid_github_profile |> Map.put("login", user_login)
      {:ok, _} = Accounts.Profiles.signin_oauth(github_provider)
      {:ok, res} = Accounts.Profiles.link_oauth(user_login, @valid_twitter_profile)

      assert res.login == user_login

      {:ok, providers} = ORM.find_all(OauthProvider, %{page: 1, size: 10})
      assert providers.total_count == 2

      first = providers.entries |> List.first()
      last = providers.entries |> List.last()

      assert first.user_id == last.user_id
      assert first.provider == "github"
      assert last.provider == "twitter"

      assert is_nil(last.raw)
    end

    test "cannot link a second account from the same provider" do
      user_login = @valid_twitter_profile["login"]
      github_provider = @valid_github_profile |> Map.put("login", user_login)
      {:ok, _} = Accounts.Profiles.signin_oauth(github_provider)

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
              :go -> Accounts.Profiles.link_oauth(user.login, @valid_twitter_profile)
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
      assert {:ok, 1} == ORM.count(OauthProvider)

      assert Enum.any?(results, fn
               {:error, reason} ->
                 Enum.into(reason, %{})[:code] == "OAUTH_IDENTITY_ALREADY_LINKED"

               _ ->
                 false
             end)
    end

    test "can unlink oauth provider" do
      user_login = @valid_twitter_profile["login"]
      github_provider = @valid_github_profile |> Map.put("login", user_login)
      {:ok, _} = Accounts.Profiles.signin_oauth(github_provider)
      {:ok, _} = Accounts.Profiles.link_oauth(user_login, @valid_twitter_profile)

      {:ok, providers} = ORM.find_all(OauthProvider, %{page: 1, size: 10})
      assert providers.total_count == 2

      {:ok, _} = Accounts.Profiles.unlink_oauth(user_login, @valid_twitter_profile)

      {:ok, providers} = ORM.find_all(OauthProvider, %{page: 1, size: 10})
      assert providers.total_count == 1
      after_delete = providers.entries |> List.first()

      assert after_delete.provider == "github"
    end

    test "canonical linked-account projection uses public refs" do
      user_login = @valid_twitter_profile["login"]
      github_provider = @valid_github_profile |> Map.put("login", user_login)
      {:ok, _} = Accounts.Profiles.signin_oauth(github_provider)
      {:ok, _} = Accounts.Profiles.link_oauth(user_login, @valid_twitter_profile)

      assert {:ok, %{entries: entries}} = Accounts.Profiles.linked_oauth_accounts(user_login)
      assert length(entries) == 2
      assert Enum.all?(entries, &(&1.can_unlink == true))

      twitter_binding = Enum.find(entries, &(&1.provider == "twitter"))

      assert {:ok, %{entries: remaining}} =
               Accounts.Profiles.unlink_oauth_identity(user_login, twitter_binding.public_ref)

      assert length(remaining) == 1
      assert hd(remaining).can_unlink == false
    end

    test "can not unlink oauth provider if there is only one" do
      user_login = @valid_twitter_profile["login"]
      github_provider = @valid_github_profile |> Map.put("login", user_login)
      {:ok, _} = Accounts.Profiles.signin_oauth(github_provider)

      {:ok, providers} = ORM.find_all(OauthProvider, %{page: 1, size: 10})
      assert providers.total_count == 1

      {:error, reason} = Accounts.Profiles.unlink_oauth(user_login, github_provider)

      assert reason |> Enum.into(%{}) |> Map.get(:code) == "OAUTH_LAST_LOGIN_METHOD"
    end
  end
end
