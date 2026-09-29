defmodule GroupherServer.CMS.ViewTracker.AnonymousSession do
  @moduledoc """
  Owns the first-party anonymous browser-session cookie used by ViewTracker.

  The cookie contains a signed random value. It is HttpOnly and has no browser
  expiration, so closing the browser can create a new anonymous identity.

      HTTP request -> verify or issue Session Cookie -> trusted request context
                   -> RequestActor.classify -> viewer_tracking_key
  """

  import Plug.Conn

  @cookie_name "groupher-viewer"
  @salt "groupher-viewer-session-v1"
  @payload_version 1
  @token_max_age 30 * 86_400

  @enforce_keys [:id]
  defstruct [:id]

  @type t :: %__MODULE__{id: String.t()}

  @doc """
  Returns the request connection and a trusted anonymous-session identity.

  A valid signed cookie is reused. A missing, expired, malformed, or
  unverifiable cookie is replaced with a newly signed HttpOnly cookie; an
  untrusted client value is never exposed as an identity.
  """
  @spec ensure(Plug.Conn.t()) :: {Plug.Conn.t(), t()}
  def ensure(%Plug.Conn{} = conn) do
    case conn.req_cookies[@cookie_name] do
      token when is_binary(token) ->
        case verify_token(token) do
          {:ok, anonymous_id} ->
            {conn, %__MODULE__{id: anonymous_id}}

          _ ->
            issue(conn)
        end

      _ ->
        issue(conn)
    end
  end

  defp issue(conn) do
    anonymous_id = Ecto.UUID.generate()

    token =
      Phoenix.Token.sign(secret(), @salt, %{
        "version" => @payload_version,
        "id" => anonymous_id
      })

    conn =
      put_resp_cookie(conn, @cookie_name, token,
        http_only: true,
        secure: secure?(conn),
        same_site: "Lax",
        path: "/"
      )

    {conn, %__MODULE__{id: anonymous_id}}
  end

  defp secret do
    Application.fetch_env!(:groupher_server, :view_tracker_cookie_secret)
  end

  defp verify_token(token) do
    Enum.find_value(cookie_secrets(), :error, fn cookie_secret ->
      case Phoenix.Token.verify(cookie_secret, @salt, token, max_age: @token_max_age) do
        {:ok, %{"version" => @payload_version, "id" => anonymous_id}}
        when is_binary(anonymous_id) ->
          {:ok, anonymous_id}

        _ ->
          false
      end
    end)
  end

  defp cookie_secrets do
    [secret(), Application.get_env(:groupher_server, :view_tracker_cookie_previous_secret)]
    |> Enum.filter(&(is_binary(&1) and byte_size(&1) > 0))
    |> Enum.uniq()
  end

  defp secure?(%Plug.Conn{scheme: :https}), do: true
  defp secure?(_conn), do: Application.get_env(:groupher_server, :env) in [:prod, :seed_prod]
end
