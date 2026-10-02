defmodule GroupherServer.Credo.Check.NoDirectOrmInTransport do
  @moduledoc false

  use Credo.Check,
    id: "GRPH002",
    base_priority: :high,
    explanations: [
      check: "Transport modules must use a named FrontDesk or Reader API instead of calling ORM directly."
    ]

  @protected_paths [~r{/lib/groupher_server_web/}]

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

  defp protected_path?(filename),
    do: Enum.any?(@protected_paths, &Regex.match?(&1, Path.expand(filename)))

  defp walk({{:., _, [{:__aliases__, meta, parts}, _function]}, _, _args} = ast, context) do
    if orm_module?(parts) do
      {ast, put_issue(context, issue_for(context, meta, "ORM"))}
    else
      {ast, context}
    end
  end

  defp walk({:alias, meta, _args} = ast, context) do
    if orm_alias_declaration?(ast) do
      {ast, put_issue(context, issue_for(context, meta, "alias ORM"))}
    else
      {ast, context}
    end
  end

  defp walk(ast, context), do: {ast, context}

  defp orm_module?(parts), do: List.last(parts) == :ORM

  defp orm_alias_declaration?(ast) do
    {_ast, found?} =
      Macro.prewalk(ast, false, fn
        {:__aliases__, _, parts} = node, found? -> {node, found? or orm_module?(parts)}
        node, found? -> {node, found?}
      end)

    found?
  end

  defp issue_for(context, meta, trigger) do
    format_issue(
      context,
      message: "Direct ORM access is forbidden in transport boundaries; use FrontDesk or a named Reader.",
      trigger: trigger,
      line_no: meta[:line],
      column: meta[:column]
    )
  end
end
