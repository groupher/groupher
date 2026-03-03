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

  def init(opts), do: opts

  def call(conn, _) do
    conn = fetch_cookies(conn)
    context = build_context(conn)
    # put_private(conn, :absinthe, %{context: context})
    # TODO: use https://github.com/absinthe-graphql/absinthe/pull/497/files
    Absinthe.Plug.put_options(conn, context: context)
  end

  @doc """
  Return the current user context based on the authorization header.

  Important: Note that at the current time this is just a stub, always
  returning the first user (marked as an admin), provided any
  authorization header is sent.
  """
  def build_context(conn) do
    with token when not is_nil(token) <- get_token_from(conn),
         {:ok, cur_user} <- authorize(token) do
      %{cur_user: cur_user}
    else
      _ -> %{}
    end
  end

  # --------------------------------------------------
  # fetch token from cookie by default，then fallback to Authorization header
  # the key auth.token need to algn with frontend at frontend/core/constant/oauth AUTH_KEY.TOKEN
  # --------------------------------------------------
  defp get_token_from(%Plug.Conn{cookies: %{"auth.token" => token}}), do: token

  defp get_token_from(%Plug.Conn{} = conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> token
      _ -> nil
    end
  end

  defp authorize(token) do
    with {:ok, claims, _info} <- Guardian.jwt_decode(token) do
      case ORM.find(User, claims.id, preload: :customization) do
        {:ok, user} ->
          check_passport(user)

        {:error, _} ->
          {:error,
           "user is not exist, try revoke token, or if you in dev env run the seeds first."}
      end
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
