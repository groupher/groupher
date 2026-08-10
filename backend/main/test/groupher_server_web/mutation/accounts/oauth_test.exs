defmodule GroupherServer.Test.Mutation.Account.Oauth do
  @moduledoc false

  use GroupherServer.TestMate
  import Helper.Utils

  alias GroupherServer.{Accounts, Repo}

  alias Accounts.Model.OauthProvider

  @server_trust_secret "test-server-trust-secret"

  @valid_github_profile mock_attrs(:oauth_profile, %{provider: "github"})
  @valid_twitter_profile mock_attrs(:oauth_profile, %{provider: "twitter"})
  @valid_google_profile mock_attrs(:oauth_profile, %{provider: "google"})

  setup do
    {:ok, user} = db_insert(:user)

    user_conn = :user |> simu_conn(user) |> with_server_trust()
    guest_conn = :guest |> simu_conn() |> with_server_trust()
    untrusted_user_conn = simu_conn(:user, user)
    untrusted_guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn untrusted_user_conn untrusted_guest_conn user)a}
  end

  describe "[oauth signin]" do
    @query S.OAuth.m(:signin_oauth)
    test "can signin oauth with github", ~m(guest_conn)a do
      variables = %{provider: gql_oauth_provider(@valid_github_profile)}

      ret = guest_conn |> gq_mutation(@query, variables)

      assert is_binary(ret["accessToken"])
      assert is_binary(ret["browserSessionRef"])

      oauth_provider =
        Repo.get_by(OauthProvider,
          provider: @valid_github_profile.provider,
          provider_id: @valid_github_profile.provider_id
        )

      assert oauth_provider.raw["login"] == @valid_github_profile.login
    end

    test "can signin oauth with google", ~m(guest_conn)a do
      variables = %{provider: gql_oauth_provider(@valid_google_profile)}

      ret = guest_conn |> gq_mutation(@query, variables)

      assert is_binary(ret["accessToken"])
      assert is_binary(ret["browserSessionRef"])

      oauth_provider =
        Repo.get_by(OauthProvider,
          provider: @valid_google_profile.provider,
          provider_id: @valid_google_profile.provider_id
        )

      assert oauth_provider.raw["sub"] == @valid_google_profile.provider_id
    end

    test "can not signin oauth without server trust", ~m(untrusted_guest_conn)a do
      variables = %{provider: gql_oauth_provider(@valid_github_profile)}

      assert untrusted_guest_conn |> mutation_error?(@query, variables, ecode(:server_trust))
    end

    @query S.OAuth.m(:link_oauth)
    test "can link oauth with twitter", ~m(user_conn user)a do
      variables = %{provider: gql_oauth_provider(@valid_twitter_profile)}

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
      variables = %{provider: gql_oauth_provider(@valid_twitter_profile)}

      assert guest_conn |> mutation_error?(@query, variables, ecode(:account_login))
    end

    test "can not link oauth with invalid server trust", ~m(untrusted_user_conn)a do
      variables = %{provider: gql_oauth_provider(@valid_twitter_profile)}

      invalid_trust_conn =
        Plug.Conn.put_req_header(
          untrusted_user_conn,
          "x-groupher-server-trust",
          "invalid-server-trust-secret"
        )

      assert invalid_trust_conn |> mutation_error?(@query, variables, ecode(:server_trust))
    end

    ##

    @query S.OAuth.m(:unlink_oauth)
    test "can unlink oauth with provider", ~m(user_conn user)a do
      github_provider = @valid_github_profile |> Map.put(:login, user.login)
      twitter_provider = @valid_twitter_profile |> Map.put(:login, user.login)

      {:ok, _} = Accounts.Profiles.link_oauth(user.login, github_provider)
      {:ok, _} = Accounts.Profiles.link_oauth(user.login, twitter_provider)

      variables = %{provider: gql_oauth_provider(@valid_twitter_profile)}

      ret = user_conn |> gq_mutation(@query, variables)

      assert ret["login"] == user.login
    end

    test "can not unlink oauth with provider when unlogged in", ~m(guest_conn user)a do
      github_provider = @valid_github_profile |> Map.put(:login, user.login)
      twitter_provider = @valid_twitter_profile |> Map.put(:login, user.login)

      {:ok, _} = Accounts.Profiles.link_oauth(user.login, github_provider)
      {:ok, _} = Accounts.Profiles.link_oauth(user.login, twitter_provider)

      variables = %{provider: gql_oauth_provider(@valid_twitter_profile)}

      assert guest_conn |> mutation_error?(@query, variables, ecode(:account_login))
    end
  end

  describe "[browser session refresh]" do
    test "returns a stable terminal code for a missing or remotely revoked session",
         ~m(guest_conn)a do
      query = """
      mutation($browserSessionRef: String!) {
        refreshBrowserSession(browserSessionRef: $browserSessionRef) {
          accessToken
        }
      }
      """

      response =
        guest_conn
        |> post("/graphiql", query: query, variables: %{"browserSessionRef" => "bs_missing"})
        |> json_response(200)

      assert get_in(response, ["errors", Access.at(0), "extensions", "code"]) ==
               "SESSION_REVOKED"
    end

    test "returns a machine auth failure for an invalid browser cookie", ~m(guest_conn)a do
      query = "mutation { updateProfile(profile: {}) { login } }"

      response =
        guest_conn
        |> Plug.Conn.put_req_header("cookie", "groupher-auth.token=invalid-token")
        |> Plug.Conn.put_req_header("content-type", "application/json")
        |> Plug.Conn.put_req_header("origin", "https://dashboard.groupher.localhost")
        |> Plug.Conn.put_req_header("x-groupher-csrf", "1")
        |> post("/graphiql", query: query, variables: %{})
        |> json_response(200)

      assert get_in(response, ["errors", Access.at(0), "extensions", "code"]) ==
               "TOKEN_INVALID"
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

  defp with_server_trust(conn) do
    Plug.Conn.put_req_header(conn, "x-groupher-server-trust", @server_trust_secret)
  end
end
