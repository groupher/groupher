defmodule GroupherServerWeb.Controller.OG do
  @moduledoc """
  handle open-graph info
  """
  use GroupherServerWeb, :controller

  alias Helper.OgInfo

  def index(conn, %{"url" => url}) do
    fetch_opengraph_info(conn, url)
  end

  # return editor-js flavor fmt
  # see https://github.com/editor-js/link
  defp fetch_opengraph_info(conn, url) do
    case OpenGraph.fetch(url) do
      {:ok, info} ->
        ok_response(conn, url, info)

      {:error, %OpenGraph.Error{} = err} ->
        handle_fetch_error(conn, url, err)
    end
  end

  # --------
  # Error handling (OpenGraph.Error only)
  # --------

  defp handle_fetch_error(conn, url, %OpenGraph.Error{reason: {:missing_redirect_location, _code}}) do
    unknown_error_response(conn, url)
  end

  defp handle_fetch_error(conn, url, %OpenGraph.Error{reason: {:unexpected_status_code, _code}}) do
    unknown_error_response(conn, url)
  end

  defp handle_fetch_error(conn, url, %OpenGraph.Error{reason: {:request_error, _msg}}) do
    # msg is a binary per typespec; keep uniform error semantics for your test
    unknown_error_response(conn, url)
  end

  # --------
  # Unified failure response (align with your test)
  # --------

  defp unknown_error_response(conn, url) do
    image_url =
      case OgInfo.get(url) do
        {:ok, og} -> og.image || og.favicon || default_favicon(url)
        {:error, _} -> default_favicon(url)
      end

    json(conn, %{
      success: 0,
      meta: %{
        title: "unknown-error",
        description: nil,
        image: %{
          url: image_url
        }
      }
    })
  end

  defp default_favicon(url) do
    uri = URI.parse(url)

    %URI{uri | path: "/favicon.ico", query: nil, fragment: nil}
    |> URI.to_string()
  end

  # --------
  # Success responses
  # --------

  defp ok_response(conn, url, %OpenGraph{title: nil, description: nil}) do
    # no useful OG -> treat as failure
    unknown_error_response(conn, url)
  end

  defp ok_response(conn, _url, %OpenGraph{title: nil, description: description} = info)
       when not is_nil(description) do
    json(conn, %{
      success: 1,
      meta: %{
        title: info.description |> String.slice(0, 8),
        description: info.description,
        image: %{
          url: nil
        }
      }
    })
  end

  defp ok_response(conn, _url, info) do
    json(conn, %{
      success: 1,
      meta: %{
        title: info.title,
        description: info.description,
        image: %{
          url: info.image
        }
      }
    })
  end
end
