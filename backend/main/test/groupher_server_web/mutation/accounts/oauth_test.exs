defmodule GroupherServer.Test.Mutation.Account.Oauth do
  @moduledoc false

  use GroupherServer.TestTools
  import Helper.Utils
  alias GroupherServer.Repo
  alias GroupherServer.Accounts.Model.OauthProvider

  @oauth_trust_code get_config(:oauth, :oauth_trust_code)

  @valid_github_profile mock_attrs(:oauth_profile, %{provider: "github"})
  @valid_twitter_profile mock_attrs(:oauth_profile, %{provider: "twitter"})
  @valid_google_profile mock_attrs(:oauth_profile, %{provider: "google"})

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
        provider: gql_oauth_provider(@valid_github_profile),
        oauthTrustCode: @oauth_trust_code
      }

      ret = guest_conn |> gq_mutation(@query, variables)

      assert ret["user"]["login"] == @valid_github_profile.login

      oauth_provider =
        Repo.get_by(OauthProvider,
          provider: @valid_github_profile.provider,
          provider_id: @valid_github_profile.provider_id
        )

      assert oauth_provider.raw["login"] == @valid_github_profile.login
    end

    test "can signin oauth with google", ~m(guest_conn)a do
      variables = %{
        provider: gql_oauth_provider(@valid_google_profile),
        oauthTrustCode: @oauth_trust_code
      }

      ret = guest_conn |> gq_mutation(@query, variables)

      assert ret["user"]["login"] == @valid_google_profile.login

      oauth_provider =
        Repo.get_by(OauthProvider,
          provider: @valid_google_profile.provider,
          provider_id: @valid_google_profile.provider_id
        )

      assert oauth_provider.raw["sub"] == @valid_google_profile.provider_id
    end

    test "can not signin oauth with un-trust code", ~m(guest_conn)a do
      variables = %{
        provider: gql_oauth_provider(@valid_github_profile),
        oauthTrustCode: "whatever"
      }

      assert guest_conn |> mutation_error?(@query, variables, ecode(:oauth_trust_code))
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
      variables = %{
        provider: gql_oauth_provider(@valid_twitter_profile),
        oauthTrustCode: @oauth_trust_code
      }

      ret = user_conn |> gq_mutation(@query, variables)

      assert ret["user"]["login"] == user.login

      oauth_provider =
        Repo.get_by(OauthProvider,
          provider: @valid_twitter_profile.provider,
          provider_id: @valid_twitter_profile.provider_id
        )

      assert oauth_provider.user_id == user.id
      assert oauth_provider.raw["username"] == @valid_twitter_profile.login
    end

    test "can not link oauth with twitter with unlogged", ~m(guest_conn)a do
      variables = %{
        provider: gql_oauth_provider(@valid_twitter_profile),
        oauthTrustCode: @oauth_trust_code
      }

      assert guest_conn |> mutation_error?(@query, variables, ecode(:account_login))
    end

    test "can not link oauth with un-trust code", ~m(user_conn)a do
      variables = %{
        provider: gql_oauth_provider(@valid_twitter_profile),
        oauthTrustCode: "whatever"
      }

      assert user_conn |> mutation_error?(@query, variables, ecode(:oauth_trust_code))
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
      github_provider = @valid_github_profile |> Map.put(:login, user.login)
      twitter_provider = @valid_twitter_profile |> Map.put(:login, user.login)

      {:ok, _} = Accounts.link_oauth(user.login, github_provider)
      {:ok, _} = Accounts.link_oauth(user.login, twitter_provider)

      variables = %{
        provider: gql_oauth_provider(@valid_twitter_profile),
        oauthTrustCode: @oauth_trust_code
      }

      ret = user_conn |> gq_mutation(@query, variables)

      assert ret["login"] == user.login
    end

    test "can not unlink oauth with provider when unlogged in", ~m(guest_conn user)a do
      github_provider = @valid_github_profile |> Map.put(:login, user.login)
      twitter_provider = @valid_twitter_profile |> Map.put(:login, user.login)

      {:ok, _} = Accounts.link_oauth(user.login, github_provider)
      {:ok, _} = Accounts.link_oauth(user.login, twitter_provider)

      variables = %{
        provider: gql_oauth_provider(@valid_twitter_profile),
        oauthTrustCode: @oauth_trust_code
      }

      assert guest_conn |> mutation_error?(@query, variables, ecode(:account_login))
    end
  end

  defp gql_oauth_provider(profile) do
    profile =
      case Map.get(profile, :raw) do
        %{} = raw -> Map.put(profile, :raw, Jason.encode!(raw))
        _ -> profile
      end

    map_key_stringify(profile)
  end
end
