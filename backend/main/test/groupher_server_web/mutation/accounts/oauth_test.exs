defmodule GroupherServer.Test.Mutation.Account.Oauth do
  @moduledoc false

  use GroupherServer.TestTools
  import Helper.Utils

  @oauth_trust_code get_config(:oauth, :oauth_trust_code)

  @valid_github_profile mock_attrs(:oauth_profile)
  @valid_twitter_profile mock_attrs(:oauth_profile)
                         |> Map.merge(%{provider: "twitter"})
                         |> map_key_stringify

  setup do
    {:ok, user} = db_insert(:user)

    user_conn = simu_conn(:user, user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn user)a}
  end

  describe "[oauth signin]" do
    @query """
    mutation($provider: OauthProviderInput!, $oauthTrustCode: String!) {
      signinOauth(provider: $provider, oauthTrustCode: $oauthTrustCode) {
        token
        user {
          login
        }
      }
    }
    """
    test "can signin oauth with github", ~m(guest_conn)a do
      variables = %{
        provider: @valid_github_profile,
        oauthTrustCode: @oauth_trust_code
      }

      ret = guest_conn |> mutation_result(@query, variables, "signinOauth")

      assert ret["user"]["login"] == @valid_github_profile.login
    end

    test "can not signin oauth with un-trust code", ~m(guest_conn)a do
      variables = %{
        provider: @valid_github_profile,
        oauthTrustCode: "whatever"
      }

      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:oauth_trust_code))
    end

    @query """
    mutation($provider: OauthProviderInput!, $oauthTrustCode: String!) {
      linkOauth(provider: $provider, oauthTrustCode: $oauthTrustCode) {
        token
        user {
          login
        }
      }
    }
    """
    test "can link oauth with twitter", ~m(user_conn user)a do
      github_provider = @valid_github_profile |> Map.put("login", user.login)

      variables = %{
        provider: @valid_twitter_profile,
        oauthTrustCode: @oauth_trust_code
      }

      ret = user_conn |> mutation_result(@query, variables, "linkOauth")

      assert ret["user"]["login"] == user.login
    end

    test "can not link oauth with twitter with unlogged", ~m(guest_conn user)a do
      github_provider = @valid_github_profile |> Map.put("login", user.login)

      variables = %{
        provider: @valid_twitter_profile,
        oauthTrustCode: @oauth_trust_code
      }

      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
    end

    test "can not link oauth with un-trust code", ~m(user_conn user)a do
      github_provider = @valid_github_profile |> Map.put("login", user.login)

      variables = %{
        provider: @valid_twitter_profile,
        oauthTrustCode: "whatever"
      }

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:oauth_trust_code))
    end

    ##

    @query """
    mutation($provider: OauthProviderInput!, $oauthTrustCode: String!) {
      unlinkOauth(provider: $provider, oauthTrustCode: $oauthTrustCode) {
        login
      }
    }
    """
    test "can unlink oauth with provider", ~m(user_conn user)a do
      github_provider = @valid_github_profile |> Map.put("login", user.login)
      twitter_provider = @valid_twitter_profile |> Map.put("login", user.login)

      {:ok, _} = Accounts.link_oauth(user.login, github_provider)
      {:ok, _} = Accounts.link_oauth(user.login, twitter_provider)

      variables = %{
        provider: @valid_twitter_profile,
        oauthTrustCode: @oauth_trust_code
      }

      ret = user_conn |> mutation_result(@query, variables, "unlinkOauth")

      assert ret["login"] == user.login
    end

    test "can not unlink oauth with provider when unlogged in", ~m(guest_conn user)a do
      github_provider = @valid_github_profile |> Map.put("login", user.login)
      twitter_provider = @valid_twitter_profile |> Map.put("login", user.login)

      {:ok, _} = Accounts.link_oauth(user.login, github_provider)
      {:ok, _} = Accounts.link_oauth(user.login, twitter_provider)

      variables = %{
        provider: @valid_twitter_profile,
        oauthTrustCode: @oauth_trust_code
      }

      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
    end
  end
end
