defmodule GroupherServer.CMS.ContentImport.Threads.Doc.DocumentFile do
  @moduledoc """
  Shared filesystem and lightweight frontmatter helpers for source adapters.

  This module deliberately knows nothing about scopes, sections or framework
  navigation. Adapters keep those semantics and use this module only to answer
  common source-file questions: what entries exist, which Markdown file matches
  a source name, what title/frontmatter it declares, and what route its path
  implies.
  """

  @extensions [".md", ".mdx"]

  @doc "Lists visible Markdown files and directories in deterministic name order."
  def entries(directory, excluded \\ []) do
    if File.dir?(directory) do
      directory
      |> File.ls!()
      |> Enum.reject(&hidden_or_excluded?(&1, excluded))
      |> Enum.map(&entry(directory, &1))
      |> Enum.reject(&is_nil/1)
      |> Enum.sort_by(& &1.name)
    else
      []
    end
  end

  @doc "Finds `name.md(x)` or `name/index.md(x)` below a directory."
  def resolve(directory, name) do
    base = Path.join(directory, name)

    [base <> ".md", base <> ".mdx", Path.join(base, "index.md"), Path.join(base, "index.mdx")]
    |> Enum.find(&File.regular?/1)
  end

  @doc "Returns flattened scalar frontmatter keys such as `sidebar.order`."
  def frontmatter(path) do
    with {:ok, body} <- File.read(path),
         ["", yaml, _rest] <- String.split(body, "---", parts: 3) do
      parse_frontmatter(yaml)
    else
      _ -> %{}
    end
  end

  @doc "Resolves a page title from frontmatter, first heading, then a fallback name."
  def title(path, fallback, keys \\ ["title"]) do
    declared_title(path, keys) || humanize(Path.basename(fallback))
  end

  @doc "Returns only an explicitly declared frontmatter or heading title."
  def declared_title(path, keys \\ ["title"]) do
    metadata = frontmatter(path)
    Enum.find_value(keys, &Map.get(metadata, &1)) || heading_title(path)
  end

  @doc "Builds a slash route from a source path relative to its content root."
  def route(path, content_root) do
    relative =
      path |> Path.relative_to(content_root) |> Path.rootname() |> String.replace("\\", "/")

    relative =
      if String.ends_with?(relative, "/index"),
        do: String.trim_trailing(relative, "index"),
        else: relative

    "/" <> String.trim(relative, "/")
  end

  @doc "Humanizes a logical name; callers should remove file extensions first."
  def humanize(value) do
    value
    |> to_string()
    |> String.replace(~r/([a-z])([A-Z])/, "\\1 \\2")
    |> String.replace(["-", "_"], " ")
    |> String.split()
    |> Enum.map_join(" ", &String.capitalize/1)
  end

  def integer(metadata, key, default \\ 999_999) do
    case Map.get(metadata, key) do
      value when is_integer(value) -> value
      value when is_binary(value) -> parse_integer(value, default)
      _ -> default
    end
  end

  defp entry(directory, name) do
    path = Path.join(directory, name)

    cond do
      File.dir?(path) -> %{kind: :directory, name: name, path: path}
      String.ends_with?(name, @extensions) -> %{kind: :file, name: name, path: path}
      true -> nil
    end
  end

  defp hidden_or_excluded?(name, excluded),
    do: String.starts_with?(name, [".", "_"]) or name in excluded

  defp parse_frontmatter(yaml) do
    {values, _section} =
      yaml
      |> String.split("\n")
      |> Enum.reduce({%{}, nil}, fn line, {values, section} ->
        case Regex.run(~r/^(\s*)([\w-]+):\s*(.*)$/, line, capture: :all_but_first) do
          ["", key, ""] ->
            {values, key}

          ["", key, value] ->
            {Map.put(values, key, clean(value)), nil}

          [_indent, key, value] when not is_nil(section) ->
            {Map.put(values, "#{section}.#{key}", clean(value)), section}

          _ ->
            {values, section}
        end
      end)

    values
  end

  defp heading_title(path) do
    with {:ok, body} <- File.read(path),
         [title] <- Regex.run(~r/^#\s+(.+)$/m, body, capture: :all_but_first) do
      String.trim(title)
    else
      _ -> nil
    end
  end

  defp clean(value), do: value |> String.trim() |> String.trim("\"'")

  defp parse_integer(value, default) do
    case Integer.parse(value) do
      {integer, ""} -> integer
      _ -> default
    end
  end
end
