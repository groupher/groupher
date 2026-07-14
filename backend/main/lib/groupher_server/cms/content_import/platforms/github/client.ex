defmodule GroupherServer.CMS.ContentImport.Platforms.GitHub.Client do
  @moduledoc "Minimal GitHub REST client used by the repository PlatformAdapter."

  alias GroupherServer.CMS.ContentImport.Diagnostic

  @callback fetch_repository(map(), keyword()) :: {:ok, map()} | {:error, Diagnostic.t()}
  @callback fetch_blob(map(), map(), keyword()) :: {:ok, binary()} | {:error, Diagnostic.t()}
  @callback fetch_releases(map(), keyword()) :: {:ok, [map()]} | {:error, Diagnostic.t()}

  @optional_callbacks fetch_releases: 2

  @spec fetch_repository(map(), keyword()) :: {:ok, map()} | {:error, Diagnostic.t()}
  def fetch_repository(connection, opts) do
    owner = value(connection, :owner)
    repo = value(connection, :repo)
    ref = value(connection, :ref, "main")

    with {:ok, commit} <-
           get_json(
             connection,
             "/repos/#{segment(owner)}/#{segment(repo)}/commits/#{segment(ref)}",
             opts
           ),
         {:ok, head_sha} <- required(commit, "sha", "github_commit_sha_missing"),
         {:ok, tree_sha} <-
           get_in_required(commit, ["commit", "tree", "sha"], "github_tree_sha_missing"),
         {:ok, tree} <-
           get_json(
             connection,
             "/repos/#{segment(owner)}/#{segment(repo)}/git/trees/#{segment(tree_sha)}?recursive=1",
             opts
           ) do
      {:ok,
       %{
         head_sha: head_sha,
         tree_sha: tree_sha,
         truncated: Map.get(tree, "truncated", false),
         entries: Map.get(tree, "tree", [])
       }}
    end
  end

  @spec fetch_releases(map(), keyword()) :: {:ok, [map()]} | {:error, Diagnostic.t()}
  def fetch_releases(connection, opts) do
    page_size = opts |> Keyword.get(:page_size, 100) |> min(100) |> max(1)
    max_pages = opts |> Keyword.get(:max_pages, 10) |> max(1)

    fetch_release_pages(connection, opts, 1, page_size, max_pages, [])
  end

  @spec fetch_blob(map(), map(), keyword()) :: {:ok, binary()} | {:error, Diagnostic.t()}
  def fetch_blob(connection, blob, opts) do
    owner = value(connection, :owner)
    repo = value(connection, :repo)

    with {:ok, payload} <-
           get_json(
             connection,
             "/repos/#{segment(owner)}/#{segment(repo)}/git/blobs/#{segment(blob["sha"])}",
             opts
           ),
         "base64" <- Map.get(payload, "encoding"),
         content when is_binary(content) <- Map.get(payload, "content"),
         {:ok, decoded} <- Base.decode64(String.replace(content, ~r/\s+/, "")) do
      {:ok, decoded}
    else
      {:error, diagnostic} ->
        {:error, diagnostic}

      _ ->
        Diagnostic.error_result(
          "github_blob_decode_failed",
          "GitHub blob response is not valid base64"
        )
    end
  end

  defp fetch_release_pages(_connection, _opts, page, _page_size, max_pages, releases)
       when page > max_pages,
       do: {:ok, releases}

  defp fetch_release_pages(connection, opts, page, page_size, max_pages, releases) do
    owner = value(connection, :owner)
    repo = value(connection, :repo)

    path =
      "/repos/#{segment(owner)}/#{segment(repo)}/releases?per_page=#{page_size}&page=#{page}"

    case get_json(connection, path, opts) do
      {:ok, page_releases} when is_list(page_releases) ->
        releases = releases ++ page_releases

        if length(page_releases) < page_size do
          {:ok, releases}
        else
          fetch_release_pages(connection, opts, page + 1, page_size, max_pages, releases)
        end

      {:ok, _invalid} ->
        Diagnostic.error_result(
          "github_releases_invalid_response",
          "GitHub releases response must be a list"
        )

      {:error, diagnostic} ->
        {:error, diagnostic}
    end
  end

  defp get_json(connection, path, opts) do
    base_url = Keyword.get(opts, :api_base_url, "https://api.github.com")
    timeout = Keyword.get(opts, :request_timeout, 30_000)

    case HTTPoison.get(base_url <> path, headers(connection),
           recv_timeout: timeout,
           timeout: timeout
         ) do
      {:ok, %HTTPoison.Response{status_code: status, body: body}} when status in 200..299 ->
        case Jason.decode(body) do
          {:ok, payload} ->
            {:ok, payload}

          {:error, reason} ->
            Diagnostic.error_result("github_invalid_response", "GitHub returned invalid JSON",
              details: reason
            )
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        Diagnostic.error_result(
          "github_request_failed",
          "GitHub request failed with status #{status}",
          details: safe_error_body(body)
        )

      {:error, %HTTPoison.Error{reason: reason}} ->
        Diagnostic.error_result("github_request_failed", "GitHub request failed", details: reason)
    end
  end

  defp headers(connection) do
    base = [
      {"accept", "application/vnd.github+json"},
      {"user-agent", "groupher-content-import"},
      {"x-github-api-version", "2022-11-28"}
    ]

    case value(connection, :token) do
      token when is_binary(token) and token != "" -> [{"authorization", "Bearer #{token}"} | base]
      _ -> base
    end
  end

  defp segment(value), do: value |> to_string() |> URI.encode(&URI.char_unreserved?/1)

  defp required(map, key, code) do
    case Map.get(map, key) do
      value when is_binary(value) and value != "" -> {:ok, value}
      _ -> Diagnostic.error_result(code, "GitHub response is missing #{key}")
    end
  end

  defp get_in_required(map, path, code) do
    case get_in(map, path) do
      value when is_binary(value) and value != "" -> {:ok, value}
      _ -> Diagnostic.error_result(code, "GitHub response is missing #{Enum.join(path, ".")}")
    end
  end

  defp safe_error_body(body) when is_binary(body), do: String.slice(body, 0, 1_000)
  defp safe_error_body(_body), do: nil

  defp value(map, key, default \\ nil) do
    Map.get(map, key, Map.get(map, Atom.to_string(key), default))
  end
end
