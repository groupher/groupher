defmodule GroupherServer.CMS.ContentImport.Threads.Doc.LinkResolver do
  @moduledoc "Rewrites source Markdown page links to the routes allocated by a Doc Plan."

  alias GroupherServer.CMS.ContentImport.Entry

  @spec new([map()]) :: (String.t(), Entry.t() -> {:ok, String.t()} | :keep)
  def new(documents) when is_list(documents) do
    by_source = Map.new(documents, &{&1["sourceId"], &1})

    by_route =
      documents
      |> Enum.reject(&is_nil(&1["route"]))
      |> Map.new(&{normalize_route(&1["route"]), &1})

    fn href, entry -> rewrite(href, entry, by_source, by_route) end
  end

  defp rewrite(href, _entry, _by_source, _by_route) when href in ["", nil], do: :keep

  defp rewrite(href, entry, by_source, by_route) do
    if external_link?(href) or String.starts_with?(href, "#") do
      :keep
    else
      {path, suffix} = split_suffix(href)

      document =
        if String.starts_with?(path, "/") do
          Map.get(by_route, normalize_route(path))
        else
          path
          |> source_candidates(entry.path)
          |> Enum.find_value(&Map.get(by_source, &1))
        end

      case document do
        %{"route" => route} when is_binary(route) and route != "" -> {:ok, route <> suffix}
        _ -> :keep
      end
    end
  end

  defp source_candidates(path, source_path) do
    base = Path.dirname(source_path || "")

    case normalize_source_path(Path.join(base, URI.decode(path))) do
      {:ok, normalized} ->
        extension = String.downcase(Path.extname(normalized))

        if extension in [".md", ".mdx"] do
          [normalized]
        else
          [
            normalized,
            normalized <> ".md",
            normalized <> ".mdx",
            Path.join(normalized, "index.md"),
            Path.join(normalized, "index.mdx")
          ]
        end

      :error ->
        []
    end
  rescue
    ArgumentError -> []
  end

  defp normalize_source_path(path) do
    path
    |> String.replace("\\", "/")
    |> String.split("/", trim: true)
    |> Enum.reduce_while([], fn
      ".", acc -> {:cont, acc}
      "..", [] -> {:halt, :error}
      "..", [_parent | rest] -> {:cont, rest}
      segment, acc -> {:cont, [segment | acc]}
    end)
    |> case do
      :error -> :error
      segments -> {:ok, segments |> Enum.reverse() |> Enum.join("/")}
    end
  end

  defp split_suffix(href) do
    case Regex.run(~r/^([^?#]*)(.*)$/, href) do
      [_full, path, suffix] -> {path, suffix}
      _ -> {href, ""}
    end
  end

  defp external_link?(href) do
    String.starts_with?(href, "//") or URI.parse(href).scheme != nil
  end

  defp normalize_route(route) do
    route
    |> String.split(["?", "#"], parts: 2)
    |> hd()
    |> String.trim()
    |> String.trim_trailing("/")
    |> case do
      "" -> "/"
      value -> "/" <> String.trim_leading(value, "/")
    end
  end
end
