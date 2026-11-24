defmodule GroupherServerWeb.ContextServiceAuthTest do
  use GroupherServer.TestMate, async: false

  import Plug.Conn
  import Plug.Test

  alias GroupherServer.{Accounts, Analysis, Auth, CMS, Repo, RequestActor}
  alias Accounts.Profiles.BrowserSessions
  alias Analysis.Model.MetricEvent
  alias Auth.Contract, as: AuthContract
  alias CMS.ViewTracker.Model.ViewDedupeState
  alias GroupherServerWeb.Context
  alias GroupherServerWeb.ServiceAuth.Verifier
  alias Helper.Guardian.BrowserAccess
  alias RequestActor.Classification

  setup do
    key = JOSE.JWK.generate_key({:rsa, 2048})
    {_, public_jwk} = key |> JOSE.JWK.to_public() |> JOSE.JWK.to_map()
    public_jwk = Map.put(public_jwk, "kid", "context-service-test-key")
    previous = Application.get_env(:groupher_server, Verifier)

    Application.put_env(:groupher_server, Verifier,
      issuer: "https://auth.groupher.test",
      audiences: ["phoenix:auth-api", "phoenix:view-api"],
      jwks: %{"keys" => [public_jwk]}
    )

    on_exit(fn -> Application.put_env(:groupher_server, Verifier, previous || []) end)
    {:ok, key: key}
  end

  test "keeps service verification failure separate from browser auth failure", %{key: key} do
    context =
      :post
      |> conn("/graphiql")
      |> put_req_header(
        "authorization",
        "Bearer #{service_token(key, %{"iss" => "https://wrong-issuer.test"})}"
      )
      |> Context.build_context()

    assert context.service_auth_failure == AuthContract.service_token_invalid()
    refute Map.has_key?(context, :service_actor)
    refute Map.has_key?(context, :auth_failure)
  end

  test "classifies a verified service and delegated browser session once", %{key: key} do
    {:ok, user} = db_insert(:user)
    {:ok, %{access_token: browser_token}} = BrowserSessions.create(user)

    context =
      key
      |> request_conn(browser_token)
      |> Context.call([])
      |> request_context()

    assert context.service_actor.subject == "service:view"
    assert context.delegated_actor.user_actor.id == user.id

    assert %Classification{
             type: :agent,
             is_authenticated: true,
             confidence: :verified,
             classified_by: :delegation_credential
           } = context.request_actor

    refute Map.has_key?(context, :delegation_auth_failure)
    refute Map.has_key?(context, :request_actor_failure)
  end

  test "an invalid delegated credential cannot downgrade to service-only classification", %{
    key: key
  } do
    context =
      key
      |> request_conn("invalid-browser-token")
      |> Context.call([])
      |> request_context()

    assert context.service_actor.subject == "service:view"
    assert context.delegation_auth_failure == AuthContract.token_invalid()
    assert context.request_actor_failure == AuthContract.token_invalid()
    refute Map.has_key?(context, :delegated_actor)
    refute Map.has_key?(context, :request_actor)
  end

  test "distinguishes a missing delegation from a malformed delegation header", %{key: key} do
    service_context =
      :post
      |> conn("/graphiql")
      |> put_req_header("authorization", "Bearer #{service_token(key)}")
      |> Context.call([])
      |> request_context()

    assert %Classification{classified_by: :agent_credential} = service_context.request_actor
    refute Map.has_key?(service_context, :delegation_auth_failure)

    malformed_context =
      :post
      |> conn("/graphiql")
      |> put_req_header("authorization", "Bearer #{service_token(key)}")
      |> put_req_header("x-groupher-user-authorization", "not-a-bearer-token")
      |> Context.call([])
      |> request_context()

    assert malformed_context.delegation_auth_failure == AuthContract.token_invalid()
    refute Map.has_key?(malformed_context, :request_actor)
  end

  test "preserves a revoked delegated session as an authentication failure", %{key: key} do
    {:ok, user} = db_insert(:user)

    {:ok, %{access_token: browser_token, browser_session_ref: session_ref}} =
      BrowserSessions.create(user)

    assert {:ok, :revoked} = BrowserSessions.revoke_current(session_ref)

    context =
      key
      |> request_conn(browser_token)
      |> Context.call([])
      |> request_context()

    assert context.delegation_auth_failure == AuthContract.session_revoked()
    assert context.request_actor_failure == AuthContract.session_revoked()
    refute Map.has_key?(context, :request_actor)
  end

  test "collapses a missing delegated session into the revoked terminal result", %{key: key} do
    {:ok, user} = db_insert(:user)

    {:ok, browser_token, _claims} =
      BrowserAccess.encode(
        user,
        "bs_missing",
        DateTime.add(DateTime.utc_now(), 3_600, :second)
      )

    context =
      key
      |> request_conn(browser_token)
      |> Context.call([])
      |> request_context()

    assert context.delegation_auth_failure == AuthContract.session_revoked()
    assert context.request_actor_failure == AuthContract.session_revoked()
    refute Map.has_key?(context, :request_actor)
  end

  test "trackArticleView rejects invalid delegation without writing view state", %{
    conn: conn,
    key: key
  } do
    {community, post, _attrs, _user} = mock_article(:post)

    mutation = """
    mutation Track($article: ArticlePathInput!) {
      trackArticleView(article: $article) {
        tracked
      }
    }
    """

    response_conn =
      conn
      |> request_conn(key, "invalid-browser-token")
      |> post("/graphiql",
        query: mutation,
        variables: %{
          "article" => %{
            "community" => community.slug,
            "thread" => "POST",
            "innerId" => Integer.to_string(article_inner_id(post, community))
          }
        }
      )

    assert response_conn.private.absinthe.context.delegation_auth_failure ==
             AuthContract.token_invalid()

    response = json_response(response_conn, 200)

    assert get_in(response, ["data", "trackArticleView"]) == nil

    assert get_in(response, ["errors", Access.at(0), "extensions", "code"]) ==
             AuthContract.token_invalid()

    assert {:ok, %{views: 0, views_revision: 0}} = CMS.ArticleStats.fetch(:post, post.id)
    assert Repo.aggregate(ViewDedupeState, :count) == 0
  end

  test "trackArticleView excludes a self-reported bot even after anonymous session creation", %{
    conn: conn
  } do
    {community, post, _attrs, _user} = mock_article(:post)

    mutation = """
    mutation Track($article: ArticlePathInput!) {
      trackArticleView(article: $article) {
        tracked
      }
    }
    """

    response_conn =
      conn
      |> put_req_header("user-agent", "ExampleBot/1.0")
      |> post("/graphiql",
        query: mutation,
        variables: %{
          "article" => %{
            "community" => community.slug,
            "thread" => "POST",
            "innerId" => Integer.to_string(article_inner_id(post, community))
          }
        }
      )

    assert %Classification{type: :unknown, classified_by: :self_reported} =
             response_conn.private.absinthe.context.request_actor

    response = json_response(response_conn, 200)
    assert get_in(response, ["data", "trackArticleView", "tracked"]) == false
    assert {:ok, %{views: 0, views_revision: 0}} = CMS.ArticleStats.fetch(:post, post.id)
    assert Repo.aggregate(ViewDedupeState, :count) == 0
    assert Repo.aggregate(MetricEvent, :count) == 0
  end

  defp request_conn(key, delegated_token) do
    :post
    |> conn("/graphiql")
    |> request_conn(key, delegated_token)
  end

  defp request_conn(conn, key, delegated_token) do
    conn
    |> put_req_header("authorization", "Bearer #{service_token(key)}")
    |> put_req_header("x-groupher-user-authorization", "Bearer #{delegated_token}")
  end

  defp request_context(conn), do: conn.private.absinthe.context

  defp service_token(key, overrides \\ %{}) do
    now = DateTime.utc_now() |> DateTime.to_unix()

    claims =
      Map.merge(
        %{
          "aud" => "phoenix:view-api",
          "exp" => now + 600,
          "iat" => now,
          "iss" => "https://auth.groupher.test",
          "jti" => "context-service-token",
          "nbf" => now,
          "scope" => "view:track",
          "sub" => "service:view"
        },
        overrides
      )

    signed =
      JOSE.JWT.sign(
        key,
        %{"alg" => "RS256", "kid" => "context-service-test-key", "typ" => "service_access+jwt"},
        claims
      )

    {_, compact} = JOSE.JWS.compact(signed)
    compact
  end
end
