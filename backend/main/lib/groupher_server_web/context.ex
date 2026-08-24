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

  @allow_test_service_auth Application.compile_env(
                             :groupher_server,
                             :allow_test_service_auth,
                             false
                           )
  @behaviour Plug

  import Plug.Conn
  # import Ecto.Query, only: [first: 1]

  alias GroupherServer.CMS

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Accounts.Profiles.BrowserSessions
  alias GroupherServer.Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias GroupherServerWeb.ServiceAuth.Verifier
  alias Helper.{Guardian, ORM}
  alias Helper.Guardian.BrowserAccess

  def init(opts), do: opts

  def call(conn, _) do
    conn = fetch_cookies(conn)
    context = build_context(conn)
    Absinthe.Plug.put_options(conn, context: context)
  end

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

        {:error, _reason} ->
          Map.put(context, :auth_failure, "SERVICE_TOKEN_INVALID")
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
            maybe_put_browser_auth_failure(context, {:bearer, token}, reason)
        end

      _ ->
        context
    end
  end

  defp authorize_delegated_browser_token(token) do
    with {:ok, claims} <- BrowserAccess.decode_claims(token),
         {:ok, cur_user} <- load_user(%{id: claims["sub"]}),
         true <- BrowserSessions.active_for_user?(cur_user.id, claims["sid"]) do
      {:ok, cur_user}
    else
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
    code = if reason == :token_expired, do: "TOKEN_EXPIRED", else: "TOKEN_INVALID"
    Map.put(context, :auth_failure, code)
  end

  defp maybe_put_browser_auth_failure(context, _token, _reason), do: context

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
