defmodule GroupherServer.Credo.Check.NoWrappedInlineDo do
  @moduledoc false

  use Credo.Check,
    id: "GRPH004",
    base_priority: :high,
    explanations: [
      check: "Inline do: is allowed only when the complete expression stays on one physical line."
    ]

  @checked_forms [:def, :defp, :defmacro, :defmacrop, :if, :unless, :case, :with]

  @doc false
  @impl true
  def run(%SourceFile{} = source_file, params) do
    context = Context.build(source_file, params, __MODULE__)

    {_ast, {context, _quote_depth}} =
      source_file
      |> SourceFile.ast()
      |> Macro.traverse({context, 0}, &prewalk/2, &postwalk/2)

    context.issues
  end

  defp prewalk({:quote, _meta, _args} = ast, {context, quote_depth}),
    do: {ast, {context, quote_depth + 1}}

  defp prewalk(
         {form, meta, args} = ast,
         {context, 0}
       )
       when form in @checked_forms and is_list(args) do
    if wrapped_inline?(meta, args) do
      trigger = Atom.to_string(form)

      issue =
        format_issue(
          context,
          message:
            "#{trigger} uses wrapped inline do:; use a block-style do/end expression instead.",
          trigger: trigger,
          line_no: meta[:line],
          column: meta[:column]
        )

      {ast, {put_issue(context, issue), 0}}
    else
      {ast, {context, 0}}
    end
  end

  defp prewalk(ast, state), do: {ast, state}

  defp postwalk({:quote, _meta, _args} = ast, {context, quote_depth}),
    do: {ast, {context, max(quote_depth - 1, 0)}}

  defp postwalk(ast, state), do: {ast, state}

  defp wrapped_inline?(meta, args) do
    start_line = meta[:line]
    end_line = get_in(meta, [:end_of_expression, :line]) || start_line
    inline_keywords = List.last(args)

    is_list(inline_keywords) and Keyword.has_key?(inline_keywords, :do) and is_nil(meta[:do]) and
      is_integer(start_line) and is_integer(end_line) and
      end_line > start_line
  end
end
