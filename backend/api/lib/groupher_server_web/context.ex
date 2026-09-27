defmodule GroupherServerWeb.Context do
  @moduledoc """
  Builds the authenticated Absinthe context at the HTTP boundary.

  It resolves browser access credentials, service JWTs, delegated-user headers,
  and Session activity into the actor data consumed by resolvers.

  Business position:

      HTTP / WebSocket client
        -> Phoenix endpoint
        -> Auth credential verification
        -> Context actor projection
        -> Absinthe resolver
  """

  require GroupherServerWeb.ErrorCat
  require GroupherServer.Accounts.Profiles.ErrorCat

  @allow_test_service_auth Application.compile_env(
                             :groupher_server,
                             :allow_test_service_auth,
                             false
                           )
  @behaviour Plug

  import Plug.Conn
  # import Ecto.Query, only: [first: 1]

  alias GroupherServer.{Accounts, Auth, CMS, RequestActor}

  alias Accounts.Model.User
  alias Accounts.Profiles.BrowserSessions
  alias Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias Auth.Contract, as: AuthContract
  alias GroupherServerWeb.ServiceAuth.Verifier
  alias GroupherServerWeb.ErrorCat
  alias Helper.{Guardian, ORM}
  alias Helper.Guardian.BrowserAccess
  alias CMS.ViewTracker.AnonymousSession

  def init(opts), do: opts

  def call(conn, _) do
    conn = fetch_cookies(conn)
    {conn, anonymous_session} = AnonymousSession.ensure(conn)

    context =
      conn
      |> build_context()
      |> Map.put(:anonymous_session, anonymous_session)
      |> put_request_actor(conn)

    Absinthe.Plug.put_options(conn, context: context)
  end

  defp put_request_actor(%{service_auth_failure: code} = context, _conn),
    do: Map.put(context, :request_actor_failure, code)

  defp put_request_actor(%{delegation_auth_failure: code} = context, _conn),
    do: Map.put(context, :request_actor_failure, code)

  defp put_request_actor(%{service_actor: _actor, auth_failure: code} = context, _conn),
    do: Map.put(context, :request_actor_failure, code)

  defp put_request_actor(context, conn) do
    opts = request_actor_input(context)
    user_agent = conn |> get_req_header("user-agent") |> List.first()

    case RequestActor.classify(Keyword.put(opts, :user_agent, user_agent)) do
      {:ok, classification} -> Map.put(context, :request_actor, classification)
      {:error, reason} -> Map.put(context, :request_actor_failure, reason)
    end
  end

  defp request_actor_input(%{delegated_actor: delegation}), do: [delegation: delegation]
  defp request_actor_input(%{service_actor: credential}), do: [service_credential: credential]
  defp request_actor_input(%{cur_user: user}), do: [account_session: user]

  defp request_actor_input(%{anonymous_session: session}),
    do: [anonymous_session: session]

  defp request_actor_input(_context), do: []

  @doc """
  Return the current user context from the Groupher auth cookie or an
  external API bearer token.
  """
  def build_context(conn) do
    context = maybe_put_test_service_actor(%{}, conn)

    case get_token_from(conn) do
      nil ->
        context

      token ->
        context
        |> authorize_context(token, conn)
        |> maybe_bind_delegated_actor()
    end
  end

  defp authorize_context(context, {:bearer, token} = credential, conn) do
    if Verifier.service_token?(token) do
      case Verifier.verify(token) do
        {:ok, actor} ->
          context
          |> Map.put(:service_actor, actor)
          |> maybe_put_delegated_user(conn)

        {:error, reason} ->
          Map.put(context, :service_auth_failure, service_auth_failure_code(reason))
      end
    else
      authorize_user_context(context, credential)
    end
  end

  defp authorize_context(context, credential, _conn),
    do: authorize_user_context(context, credential)

  defp maybe_bind_delegated_actor(%{service_actor: service, cur_user: user} = context) do
    Map.put_new(context, :delegated_actor, %{service_actor: service, user_actor: user})
  end

  defp maybe_bind_delegated_actor(context), do: context

  defp service_auth_failure_code(ErrorCat.error_pattern(reason: :jwks_unavailable)),
    do: AuthContract.service_jwks_unavailable()

  defp service_auth_failure_code(_reason), do: AuthContract.service_token_invalid()

  defp maybe_put_test_service_actor(context, conn) do
    if @allow_test_service_auth and
         Application.get_env(:groupher_server, :env) == :test and
         get_req_header(conn, "x-groupher-test-service-auth") == ["enabled"] do
      Map.put(context, :service_actor, %{
        audience: "test:any",
        scopes: MapSet.new(["*"]),
        subject: "service:test-suite",
        token_id: "test-suite"
      })
    else
      context
    end
  end

  defp maybe_put_delegated_user(context, conn) do
    case get_req_header(conn, "x-groupher-user-authorization") do
      [] ->
        context

      ["Bearer " <> token] ->
        case authorize_delegated_browser_token(token) do
          {:ok, cur_user} ->
            context
            |> Map.put(:cur_user, cur_user)
            |> Map.put(:delegated_actor, %{
              service_actor: context.service_actor,
              user_actor: cur_user
            })

          {:error, reason} ->
            Map.put(context, :delegation_auth_failure, delegation_auth_failure_code(reason))
        end

      _malformed ->
        Map.put(context, :delegation_auth_failure, AuthContract.token_invalid())
    end
  end

  defp authorize_delegated_browser_token(token) do
    with {:ok, claims} <- BrowserAccess.decode_claims(token),
         {:ok, cur_user} <- load_user(%{id: claims["sub"]}),
         true <- BrowserSessions.active_for_user?(cur_user.id, claims["sid"]) do
      {:ok, cur_user}
    else
      # Missing, revoked, and otherwise inactive Sessions share one terminal result.
      false -> {:error, ProfileErrorCat.session_revoked()}
      error -> error
    end
  end

  defp authorize_user_context(context, credential) do
    case authorize(credential) do
      {:ok, cur_user} -> Map.put(context, :cur_user, cur_user)
      {:error, reason} -> maybe_put_browser_auth_failure(context, credential, reason)
    end
  end

  defp maybe_put_browser_auth_failure(context, {:browser, _token}, reason) do
    code =
      if reason == :token_expired,
        do: AuthContract.token_expired(),
        else: AuthContract.token_invalid()

    Map.put(context, :auth_failure, code)
  end

  defp maybe_put_browser_auth_failure(context, _token, _reason), do: context

  defp delegation_auth_failure_code(:token_expired), do: AuthContract.token_expired()

  defp delegation_auth_failure_code(ProfileErrorCat.error_pattern(reason: :session_revoked)),
    do: AuthContract.session_revoked()

  defp delegation_auth_failure_code(_reason), do: AuthContract.token_invalid()

  # --------------------------------------------------
  # Browser cookies must satisfy the V1 issuer/audience/type/session claims.
  # External bearer-token contracts retain their own Guardian verification path.
  # --------------------------------------------------
  defp get_token_from(%Plug.Conn{cookies: %{"groupher-auth.token" => token}}),
    do: {:browser, token}

  defp get_token_from(%Plug.Conn{} = conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> {:bearer, token}
      _ -> nil
    end
  end

  defp authorize({:browser, token}) do
    with {:ok, claims} <- BrowserAccess.decode_claims(token),
         {:ok, resource} <- BrowserAccess.resource_from_claims(claims) do
      load_user(resource)
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp authorize({:bearer, token}) do
    with {:ok, claims, _info} <- Guardian.jwt_decode(token) do
      load_user(claims)
    end
  end

  defp load_user(claims) do
    case ORM.find(User, claims.id) do
      {:ok, user} ->
        check_passport(user)

      {:error, _} ->
        {:error, "user is not exist, try revoke token, or if you in dev env run the seeds first."}
    end
  end

  defp check_passport(%User{} = user) do
    case CMS.Communities.get_passport(%User{id: user.id}) do
      {:ok, passport} -> {:ok, Map.put(user, :cur_passport, passport)}
      {:error, _} -> {:ok, user}
    end
  end
end
