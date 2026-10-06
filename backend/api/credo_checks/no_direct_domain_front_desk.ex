defmodule GroupherServer.Credo.Check.NoDirectDomainFrontDesk do
  @moduledoc false

  use Credo.Check,
    id: "GRPH003",
    base_priority: :high,
    explanations: [
      check:
        "Web and cross-domain callers must use the root FrontDesk facade instead of a domain FrontDesk."
    ]

  @protected_paths [
    ~r{/lib/groupher_server_web/},
    ~r{/lib/groupher_server/(accounts|messaging|support)/}
  ]

  @doc false
  @impl true
  def run(%SourceFile{} = source_file, params) do
    if protected_path?(source_file.filename) do
      context = Context.build(source_file, params, __MODULE__)
      Credo.Code.prewalk(source_file, &walk/2, context).issues
    else
      []
    end
  end

  defp protected_path?(filename) do
    path = Path.expand(filename)

    not (String.contains?(path, "/lib/groupher_server/accounts/front_desk/") or
           String.ends_with?(path, "/lib/groupher_server/accounts/front_desk.ex")) and
      Enum.any?(@protected_paths, &Regex.match?(&1, path))
  end

  defp walk({:alias, meta, _args} = ast, context) do
    if domain_front_desk_alias?(ast) do
      {ast, put_issue(context, issue_for(context, meta, "domain FrontDesk alias"))}
    else
      {ast, context}
    end
  end

  defp walk({{:., _, [{:__aliases__, meta, parts}, _function]}, _, _args} = ast, context) do
    if domain_front_desk?(parts) do
      {ast, put_issue(context, issue_for(context, meta, "domain FrontDesk"))}
    else
      {ast, context}
    end
  end

  defp walk(ast, context), do: {ast, context}

  defp domain_front_desk?(parts) do
    parts = Enum.map(parts, fn part -> if is_atom(part), do: Atom.to_string(part), else: "" end)
    Enum.any?(parts, &(&1 in ["CMS", "Accounts"])) and List.last(parts) == "FrontDesk"
  end

  defp domain_front_desk_alias?({:alias, _meta, args}) do
    {_ast, found?} =
      Macro.prewalk(args, false, fn
        {:__aliases__, _, parts} = node, found? -> {node, found? or domain_front_desk?(parts)}
        node, found? -> {node, found?}
      end)

    found?
  end

  defp issue_for(context, meta, trigger) do
    format_issue(
      context,
      message: "Use GroupherServer.FrontDesk at web and cross-domain boundaries.",
      trigger: trigger,
      line_no: meta[:line],
      column: meta[:column]
    )
  end
end
