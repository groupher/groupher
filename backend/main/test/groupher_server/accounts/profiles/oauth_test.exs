defmodule GroupherServer.Test.Accounts.Oauth do
  @moduledoc false

  use GroupherServer.TestTools
  import Helper.Utils

  alias Accounts.Model.OauthProvider

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

      {:ok, signin_res} = Accounts.signin_oauth(@valid_github_profile)

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

      assert oauth_provider.raw["login"] == @valid_github_profile["login"]
      assert oauth_provider.raw["avatar_url"] == @valid_github_profile["avatar"]

      assert signin_res |> Map.has_key?(:user)
      assert signin_res |> Map.has_key?(:token)
    end

    test "existing user can signin" do
      {:ok, signin_res} = Accounts.signin_oauth(@valid_github_profile)

      assert signin_res |> Map.has_key?(:user)
      assert signin_res |> Map.has_key?(:token)
    end

    test "existing user can signin multiple times" do
      {:ok, _} = Accounts.signin_oauth(@valid_github_profile)
      {:ok, _} = Accounts.signin_oauth(@valid_github_profile)
      {:ok, _} = Accounts.signin_oauth(@valid_github_profile)
      {:ok, _} = Accounts.signin_oauth(@valid_github_profile)

      assert {:ok, 1} == ORM.count(OauthProvider)
    end

    test "existing non-existing user fails" do
      {:ok, _signin_res} =
        Accounts.signin_oauth(@valid_github_profile)

      {:error, _res} =
        Accounts.signin_oauth(%{@valid_github_profile | "provider_id" => "non-existing-id"})
    end

    test "can link oauth provider to existing user" do
      user_login = @valid_twitter_profile["login"]
      github_provider = @valid_github_profile |> Map.put("login", user_login)
      {:ok, _} = Accounts.signin_oauth(github_provider)
      {:ok, res} = Accounts.link_oauth(user_login, @valid_twitter_profile)

      assert res |> Map.has_key?(:user)
      assert res |> Map.has_key?(:token)

      {:ok, providers} = ORM.find_all(OauthProvider, %{page: 1, size: 10})
      assert providers.total_count == 2

      first = providers.entries |> List.first()
      last = providers.entries |> List.last()

      assert first.user_id == last.user_id
      assert first.provider == "github"
      assert last.provider == "twitter"

      assert last.raw["username"] == @valid_twitter_profile["login"]
    end

    test "can unlink oauth provider" do
      user_login = @valid_twitter_profile["login"]
      github_provider = @valid_github_profile |> Map.put("login", user_login)
      {:ok, _} = Accounts.signin_oauth(github_provider)
      {:ok, _} = Accounts.link_oauth(user_login, @valid_twitter_profile)

      {:ok, providers} = ORM.find_all(OauthProvider, %{page: 1, size: 10})
      assert providers.total_count == 2

      {:ok, _} = Accounts.unlink_oauth(user_login, @valid_twitter_profile)

      {:ok, providers} = ORM.find_all(OauthProvider, %{page: 1, size: 10})
      assert providers.total_count == 1
      after_delete = providers.entries |> List.first()

      assert after_delete.provider == "github"
    end

    test "can not unlink oauth provider if there is only one" do
      user_login = @valid_twitter_profile["login"]
      github_provider = @valid_github_profile |> Map.put("login", user_login)
      {:ok, _} = Accounts.signin_oauth(github_provider)

      {:ok, providers} = ORM.find_all(OauthProvider, %{page: 1, size: 10})
      assert providers.total_count == 1

      {:error, reason} = Accounts.unlink_oauth(user_login, github_provider)

      assert reason |> Enum.into(%{}) |> Map.get(:code) == ecode(:oauth_unlink)
    end
  end
end
