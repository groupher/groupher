# a plug for router ...

defmodule GroupherServerWeb.Context do
  @moduledoc """
  entry for all api
  """
  @behaviour Plug

  import Plug.Conn
  # import Ecto.Query, only: [first: 1]

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias Helper.{Guardian, ORM}
  alias Helper.Guardian.BrowserAccess

  def init(opts), do: opts

  def call(conn, _) do
    conn = fetch_cookies(conn)
    context = build_context(conn)
    # put_private(conn, :absinthe, %{context: context})
    # TODO: use https://github.com/absinthe-graphql/absinthe/pull/497/files
    Absinthe.Plug.put_options(conn, context: context)
  end

  @doc """
  Return the current user context from the Groupher auth cookie or an
  external API bearer token.
  """
  def build_context(conn) do
    context = %{server_trusted: server_trusted?(conn)}

    case get_token_from(conn) do
      nil ->
        context

      token ->
        case authorize(token) do
          {:ok, cur_user} -> Map.put(context, :cur_user, cur_user)
          {:error, reason} -> maybe_put_browser_auth_failure(context, token, reason)
        end
    end
  end

  defp maybe_put_browser_auth_failure(context, {:browser, _token}, reason) do
    code = if reason == :token_expired, do: "TOKEN_EXPIRED", else: "TOKEN_INVALID"
    Map.put(context, :auth_failure, code)
  end

  defp maybe_put_browser_auth_failure(context, _token, _reason), do: context

  defp server_trusted?(conn) do
    expected =
      :groupher_server
      |> Application.get_env(:server_trust, [])
      |> Keyword.get(:secret)

    case {expected, get_req_header(conn, "x-groupher-server-trust")} do
      {expected, [provided]}
      when is_binary(expected) and byte_size(expected) > 0 and
             byte_size(expected) == byte_size(provided) ->
        Plug.Crypto.secure_compare(expected, provided)

      _ ->
        false
    end
  end

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

  # TODO gather role info from CMS or other context
  defp check_passport(%User{} = user) do
    case CMS.Communities.get_passport(%User{id: user.id}) do
      {:ok, passport} -> {:ok, Map.put(user, :cur_passport, passport)}
      {:error, _} -> {:ok, user}
    end
  end
end
