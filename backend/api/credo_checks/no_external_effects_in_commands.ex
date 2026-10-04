defmodule GroupherServer.Credo.Check.NoExternalEffectsInCommands do
  @moduledoc false

  use Credo.Check,
    id: "GRPH003",
    base_priority: :high,
    explanations: [
      check:
        "Command action callbacks may persist Outbox intents, but must not call external effects directly."
    ]

  @protected_paths [
    ~r{/lib/groupher_server/cms/.+/commands/},
    ~r{/lib/groupher_server/cms/command\.ex$}
  ]

  @forbidden_roots ~w(Req Finch HTTPoison Tesla Task Oban GenServer Supervisor Agent Registry)a

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

  defp walk(
         {{:., _, [{:__aliases__, alias_meta, parts}, _function]}, _call_meta, _args} = ast,
         context
       ) do
    if forbidden_alias?(parts) do
      {ast, put_issue(context, issue_for(context, alias_meta, List.first(parts)))}
    else
      {ast, context}
    end
  end

  defp walk({{:., meta, [root, _function]}, _call_meta, _args} = ast, context)
       when is_atom(root) do
    if root in @forbidden_roots do
      {ast, put_issue(context, issue_for(context, meta, root))}
    else
      {ast, context}
    end
  end

  defp walk({:use, meta, [{:__aliases__, _, parts} | _]} = ast, context) do
    if forbidden_alias?(parts) do
      {ast, put_issue(context, issue_for(context, meta, List.first(parts)))}
    else
      {ast, context}
    end
  end

  defp walk({:alias, meta, _args} = ast, context) do
    {_ast, forbidden?} =
      Macro.prewalk(ast, false, fn
        {:__aliases__, _, parts} = node, found? -> {node, found? or forbidden_alias?(parts)}
        node, found? -> {node, found?}
      end)

    if forbidden?,
      do: {ast, put_issue(context, issue_for(context, meta, "alias"))},
      else: {ast, context}
  end

  defp walk(ast, context), do: {ast, context}

  defp forbidden_alias?(parts), do: List.first(parts) in @forbidden_roots

  defp issue_for(context, meta, trigger) do
    format_issue(
      context,
      message:
        "Direct external effects are forbidden in Command modules; persist an Outbox intent and let a worker call the external service.",
      trigger: to_string(trigger),
      line_no: meta[:line],
      column: meta[:column]
    )
  end
end
