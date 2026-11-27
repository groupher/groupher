defmodule GroupherServer.Test.Mutation.Account.Oauth do
  @moduledoc false

  use GroupherServer.TestMate
  import Helper.Utils

  alias GroupherServer.{Accounts, Repo}

  alias Accounts.Model.OauthProvider

  @test_service_auth "enabled"

  @valid_github_profile mock_attrs(:oauth_profile, %{provider: "github"})
  @valid_linuxdo_profile mock_attrs(:oauth_profile, %{provider: "linuxdo"})

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

      assert ret["status"] == "SIGNED_IN"
      assert is_binary(ret["session"]["accessToken"])
      assert is_binary(ret["session"]["browserSessionRef"])

      oauth_provider =
        Repo.get_by(OauthProvider,
          provider: @valid_github_profile.provider,
          provider_id: @valid_github_profile.provider_id
        )

      assert is_nil(oauth_provider.raw)
    end

    test "can signin oauth with linuxdo", ~m(guest_conn)a do
      variables = %{provider: gql_oauth_provider(@valid_linuxdo_profile)}

      ret = guest_conn |> gq_mutation(@query, variables)

      assert ret["status"] == "SIGNED_IN"
      assert is_binary(ret["session"]["accessToken"])
      assert is_binary(ret["session"]["browserSessionRef"])

      oauth_provider =
        Repo.get_by(OauthProvider,
          provider: @valid_linuxdo_profile.provider,
          provider_id: @valid_linuxdo_profile.provider_id
        )

      assert is_nil(oauth_provider.raw)
    end

    test "can not signin oauth without server trust", ~m(untrusted_guest_conn)a do
      variables = %{provider: gql_oauth_provider(@valid_github_profile)}

      assert untrusted_guest_conn
             |> mutation_error?(
               @query,
               variables,
               GroupherServer.Auth.Contract.service_token_invalid()
             )
    end
  end

  test "registration requires the dedicated service scope before consuming its flow" do
    provider = %{
      provider: "linuxdo",
      provider_id: "scope-registration",
      login: "scope_registration"
    }

    ref = "scope_registration_flow"
    assert {:ok, _} = Accounts.Profiles.OauthFlows.create_registration(ref, provider, nil)

    query = """
    mutation($ref: String!, $login: String!) {
      completeOauthRegistration(flowRef: $ref, login: $login) { browserSessionRef }
    }
    """

    actor = %{
      audience: "phoenix:auth-api",
      scopes: MapSet.new(["auth:session:signin"]),
      subject: "service:auth"
    }

    options = [
      variables: %{"ref" => ref, "login" => "scope_registration"},
      context: %{service_actor: actor}
    ]

    assert {:ok, denied} = Absinthe.run(query, GroupherServerWeb.Schema, options)
    assert [%{extensions: %{code: code}}] = denied.errors

    assert code ==
             GroupherServerWeb.ErrorCat.code(GroupherServerWeb.ErrorCat.service_scope_forbidden())

    assert {:ok, _} = Accounts.Profiles.OauthFlows.registration_summary(ref)
    refute Repo.get_by(OauthProvider, provider: "linuxdo", provider_id: "scope-registration")

    allowed_actor = %{actor | scopes: MapSet.new(["auth:oauth:register"])}

    assert {:ok, %{data: %{"completeOauthRegistration" => %{"browserSessionRef" => session_ref}}}} =
             Absinthe.run(
               query,
               GroupherServerWeb.Schema,
               Keyword.put(options, :context, %{service_actor: allowed_actor})
             )

    assert is_binary(session_ref)
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
        |> Plug.Conn.put_req_header("origin", "https://dash.groupher.localhost")
        |> Plug.Conn.put_req_header("x-groupher-csrf", "1")
        |> post("/graphiql", query: query, variables: %{})
        |> json_response(200)

      assert get_in(response, ["errors", Access.at(0), "extensions", "code"]) ==
               "TOKEN_INVALID"
    end
  end

  describe "[canonical oauth accounts]" do
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

    test "unlinks an existing binding through the public-ref contract", ~m(user_conn user)a do
      github_identity = Map.put(@valid_github_profile, :login, user.login)
      linuxdo_identity = Map.put(@valid_linuxdo_profile, :login, user.login)
      assert {:ok, _} = Accounts.Profiles.link_oauth(user.login, github_identity)
      assert {:ok, _} = Accounts.Profiles.link_oauth(user.login, linuxdo_identity)
      binding = Repo.get_by!(OauthProvider, user_id: user.id, provider: "linuxdo")
      unlinked = user_conn |> gq_mutation(@unlink_query, %{publicRef: binding.public_ref})
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
