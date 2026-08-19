defmodule GroupherServer.Test.Mutation.Account.Oauth do
  @moduledoc false

  use GroupherServer.TestMate
  import Helper.Utils

  alias GroupherServer.{Accounts, Repo}

  alias Accounts.Model.OauthProvider

  @test_service_auth "enabled"

  @valid_github_profile mock_attrs(:oauth_profile, %{provider: "github"})
  @valid_twitter_profile mock_attrs(:oauth_profile, %{provider: "twitter"})
  @valid_google_profile mock_attrs(:oauth_profile, %{provider: "google"})

  setup do
    {:ok, user} = db_insert(:user)

    user_conn = :user |> simu_conn(user) |> with_test_service_auth()
    guest_conn = :guest |> simu_conn() |> with_test_service_auth()
    untrusted_guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn untrusted_guest_conn user)a}
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

      assert is_nil(oauth_provider.raw)
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

      assert is_nil(oauth_provider.raw)
    end

    test "can not signin oauth without server trust", ~m(untrusted_guest_conn)a do
      variables = %{provider: gql_oauth_provider(@valid_github_profile)}

      assert untrusted_guest_conn
             |> mutation_error?(
               @query,
               variables,
               ErrorCat.code(GroupherServerWeb.ErrorCat.service_auth())
             )
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

  describe "[canonical oauth accounts]" do
    @link_query """
    mutation($identity: VerifiedOauthIdentityInput!) {
      linkOauthIdentity(identity: $identity) {
        entries {
          publicRef
          provider
          canUnlink
        }
      }
    }
    """

    @unlink_query """
    mutation($publicRef: ID!) {
      unlinkOauthIdentity(publicRef: $publicRef) {
        entries {
          publicRef
          provider
          canUnlink
        }
      }
    }
    """

    test "links and unlinks through the canonical public-ref contract", ~m(user_conn)a do
      identity = %{
        provider: @valid_twitter_profile.provider,
        provider_id: @valid_twitter_profile.provider_id,
        login: @valid_twitter_profile.login,
        nickname: @valid_twitter_profile.nickname,
        avatar: @valid_twitter_profile.avatar
      }

      linked = user_conn |> gq_mutation(@link_query, %{identity: identity})

      assert [%{"publicRef" => public_ref, "provider" => "twitter", "canUnlink" => false}] =
               linked["entries"]

      github_identity = %{
        provider: @valid_github_profile.provider,
        provider_id: @valid_github_profile.provider_id,
        login: @valid_github_profile.login,
        nickname: @valid_github_profile.nickname,
        avatar: @valid_github_profile.avatar
      }

      linked = user_conn |> gq_mutation(@link_query, %{identity: github_identity})
      assert length(linked["entries"]) == 2

      unlinked = user_conn |> gq_mutation(@unlink_query, %{publicRef: public_ref})
      assert [%{"provider" => "github", "canUnlink" => false}] = unlinked["entries"]
    end
  end

  defp gql_oauth_provider(profile) do
    profile |> Map.drop([:raw, "raw"]) |> map_key_stringify()
  end

  defp with_test_service_auth(conn) do
    Plug.Conn.put_req_header(conn, "x-groupher-test-service-auth", @test_service_auth)
  end
end
