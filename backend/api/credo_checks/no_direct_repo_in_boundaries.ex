defmodule GroupherServer.Credo.Check.NoDirectRepoInBoundaries do
  @moduledoc false

  use Credo.Check,
    id: "GRPH001",
    base_priority: :high,
    explanations: [
      check: """
      Transport, command orchestration, and public facade modules must not call
      Repo directly. Reads go through FrontDesk/Reader boundaries; writes and
      transactions belong to Writer/Store modules.
      """
    ]

  @protected_paths [
    ~r{/lib/groupher_server_web/},
    ~r{/lib/groupher_server/cms/.+/commands/},
    ~r{/lib/groupher_server/cms/(assets|articles|comments|communities|docs|doc_tree|interactions)\.ex$},
    ~r{/lib/groupher_server/cms/(command|command_receipt|front_desk)\.ex$}
  ]

  @doc false
  @impl true
  def run(%SourceFile{} = source_file, params) do
    if protected_path?(source_file.filename) do
      context = Context.build(source_file, params, __MODULE__)
      result = Credo.Code.prewalk(source_file, &walk/2, context)
      result.issues
    else
      []
    end
  end

  defp protected_path?(filename),
    do: Enum.any?(@protected_paths, &Regex.match?(&1, Path.expand(filename)))

  defp walk({{:., _, [{:__aliases__, meta, parts}, _function]}, _, _args} = ast, context) do
    if repo_alias?(parts) do
      trigger = if length(parts) == 1, do: "Repo", else: parts |> hd() |> to_string()
      {ast, put_issue(context, issue_for(context, meta, trigger))}
    else
      {ast, context}
    end
  end

  defp walk({:alias, meta, _args} = ast, context) do
    if repo_alias_declaration?(ast) do
      {ast, put_issue(context, issue_for(context, meta, "alias Grou"))}
    else
      {ast, context}
    end
  end

  defp walk(ast, context), do: {ast, context}

  defp repo_alias?(parts), do: List.last(parts) == :Repo

  defp repo_alias_declaration?(ast) do
    {_ast, found?} =
      Macro.prewalk(ast, false, fn
        {:__aliases__, _, parts} = node, found? -> {node, found? or repo_alias?(parts)}
        node, found? -> {node, found?}
      end)

    found?
  end

  defp issue_for(context, meta, trigger) do
    format_issue(
      context,
      message:
        "Direct Repo access is forbidden in transport, command, and facade boundaries; use FrontDesk/Reader or move persistence into Writer/Store.",
      trigger: trigger,
      line_no: meta[:line],
      column: meta[:column]
    )
  end
end
