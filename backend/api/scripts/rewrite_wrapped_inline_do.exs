defmodule RewriteWrappedInlineDo do
  @moduledoc false

  @checked_forms [:def, :defp, :defmacro, :defmacrop, :if, :unless, :case, :with]

  def main(args) do
    {mode, roots} = parse_args(args)
    files = source_files(roots)

    results = Enum.map(files, &process_file(&1, mode))
    issue_count = Enum.reduce(results, 0, fn {_file, count}, total -> total + count end)
    file_count = Enum.count(results, fn {_file, count} -> count > 0 end)

    IO.puts("wrapped inline do: #{issue_count} occurrence(s) in #{file_count} file(s)")

    if mode == :check and issue_count > 0 do
      System.halt(1)
    end
  end

  defp parse_args([mode | roots]) when mode in ["--check", "--write"] do
    parsed_mode = if mode == "--write", do: :write, else: :check
    {parsed_mode, default_roots(roots)}
  end

  defp parse_args(args), do: {:check, default_roots(args)}

  defp default_roots([]), do: ["lib", "test"]
  defp default_roots(roots), do: roots

  defp source_files(roots) do
    roots
    |> Enum.flat_map(fn root ->
      cond do
        File.regular?(root) ->
          [root]

        File.dir?(root) ->
          Path.wildcard(Path.join(root, "**/*.{ex,exs}"))

        true ->
          raise ArgumentError, "source path does not exist: #{root}"
      end
    end)
    |> Enum.uniq()
    |> Enum.sort()
  end

  defp process_file(file, mode) do
    source = File.read!(file)
    rewrites = find_rewrites!(source, file)

    if rewrites != [] do
      IO.puts("#{file}: #{length(rewrites)}")
    end

    if mode == :write and rewrites != [] do
      rewritten = rewrite_all(source, file)
      parse!(rewritten, file)
      File.write!(file, rewritten)
    end

    {file, length(rewrites)}
  end

  defp find_rewrites!(source, file) do
    ast = parse!(source, file)

    {_ast, {rewrites, _quote_depth}} =
      Macro.traverse(ast, {[], 0}, &collect_pre/2, &collect_post/2)

    rewrites
    |> Enum.sort_by(&{&1.start_line, &1.end_line})
  end

  defp parse!(source, file) do
    case Code.string_to_quoted(source,
           file: file,
           columns: true,
           token_metadata: true
         ) do
      {:ok, ast} -> ast
      {:error, error} -> raise SyntaxError, description: inspect(error), file: file
    end
  end

  defp collect_pre({:quote, _meta, _args} = ast, {rewrites, quote_depth}) do
    {ast, {rewrites, quote_depth + 1}}
  end

  defp collect_pre(
         {form, meta, args} = ast,
         {rewrites, 0}
       )
       when form in @checked_forms and is_list(args) do
    if wrapped_inline?(meta, args) do
      rewrite = %{
        form: form,
        start_line: meta[:line],
        end_line: get_in(meta, [:end_of_expression, :line]),
        indent: max((meta[:column] || 1) - 1, 0),
        clauses: args |> List.last() |> Keyword.keys()
      }

      {ast, {[rewrite | rewrites], 0}}
    else
      {ast, {rewrites, 0}}
    end
  end

  defp collect_pre(ast, state), do: {ast, state}

  defp collect_post({:quote, _meta, _args} = ast, {rewrites, quote_depth}) do
    {ast, {rewrites, max(quote_depth - 1, 0)}}
  end

  defp collect_post(ast, state), do: {ast, state}

  defp wrapped_inline?(meta, args) do
    start_line = meta[:line]
    end_line = get_in(meta, [:end_of_expression, :line]) || start_line
    inline_keywords = List.last(args)

    is_list(inline_keywords) and Keyword.has_key?(inline_keywords, :do) and is_nil(meta[:do]) and
      is_integer(start_line) and is_integer(end_line) and end_line > start_line
  end

  defp rewrite_all(source, file) do
    case find_rewrites!(source, file) do
      [] ->
        source

      rewrites ->
        rewrite =
          Enum.max_by(rewrites, fn item ->
            {item.start_line, -(item.end_line - item.start_line)}
          end)

        source
        |> rewrite([rewrite])
        |> rewrite_all(file)
    end
  end

  defp rewrite(source, rewrites) do
    trailing_newline? = String.ends_with?(source, "\n")
    lines = String.split(source, "\n", trim: false)

    rewritten =
      rewrites
      |> Enum.sort_by(& &1.start_line, :desc)
      |> Enum.reduce(lines, &rewrite_expression/2)
      |> Enum.join("\n")

    if trailing_newline? and not String.ends_with?(rewritten, "\n") do
      rewritten <> "\n"
    else
      rewritten
    end
  end

  defp rewrite_expression(rewrite, lines) do
    start_index = rewrite.start_line - 1
    end_index = rewrite.end_line - 1
    body_indent = rewrite.indent + 2

    {lines, parenthesized_close} =
      normalize_parenthesized_form(lines, start_index, end_index, rewrite)

    do_index = find_clause_line!(lines, start_index, end_index, "do", rewrite)
    head_index = previous_content_line!(lines, do_index - 1, start_index, rewrite)

    lines = List.update_at(lines, head_index, &replace_trailing_comma_with_do!/1)
    {lines, end_index} = rewrite_do_clause(lines, do_index, end_index, body_indent)

    {lines, end_index} =
      if :else in rewrite.clauses do
        else_index =
          find_clause_line!(lines, do_index, end_index, "else", rewrite)

        body_index = previous_content_line!(lines, else_index - 1, do_index, rewrite)
        lines = List.update_at(lines, body_index, &remove_trailing_comma!/1)
        rewrite_else_clause(lines, else_index, end_index, rewrite.indent, body_indent)
      else
        {lines, end_index}
      end

    end_line = String.duplicate(" ", rewrite.indent) <> "end"

    if parenthesized_close == :own_line do
      List.replace_at(lines, end_index, end_line)
    else
      List.insert_at(lines, end_index + 1, end_line)
    end
  end

  defp normalize_parenthesized_form(lines, start_index, end_index, rewrite) do
    start_line = Enum.at(lines, start_index)
    pattern = ~r/^(\s*#{rewrite.form})\(/

    if Regex.match?(pattern, start_line) do
      lines =
        List.replace_at(
          lines,
          start_index,
          Regex.replace(pattern, start_line, "\\1 ", global: false)
        )

      closing_line = Enum.at(lines, end_index)

      if String.trim(closing_line) == ")" do
        {List.replace_at(lines, end_index, "__WRAPPED_INLINE_DO_END__"), :own_line}
      else
        normalized_close = Regex.replace(~r/\)(\s*(?:#.*)?)$/, closing_line, "\\1", global: false)

        if normalized_close == closing_line do
          raise "expected a closing parenthesis for #{inspect(rewrite)}"
        end

        {List.replace_at(lines, end_index, normalized_close), :same_line}
      end
    else
      {lines, :none}
    end
  end

  defp find_clause_line!(lines, first, last, clause, rewrite) do
    pattern = ~r/^\s*#{clause}:(?:\s|$)/

    Enum.find(first..last, fn index -> Regex.match?(pattern, Enum.at(lines, index)) end) ||
      raise "could not locate #{clause}: for #{inspect(rewrite)}"
  end

  defp previous_content_line!(lines, index, minimum, rewrite) do
    Enum.find(index..minimum//-1, fn current ->
      lines |> Enum.at(current) |> String.trim() != ""
    end) || raise "could not locate previous expression line for #{inspect(rewrite)}"
  end

  defp replace_trailing_comma_with_do!(line) do
    case Regex.run(~r/^(.*),([ \t]*(?:#.*)?)$/, line, capture: :all_but_first) do
      [expression, suffix] -> expression <> " do" <> suffix
      _ -> raise "expected a trailing comma before do:, got: #{inspect(line)}"
    end
  end

  defp remove_trailing_comma!(line) do
    case Regex.run(~r/^(.*),([ \t]*(?:#.*)?)$/, line, capture: :all_but_first) do
      [expression, suffix] -> expression <> suffix
      _ -> raise "expected a trailing comma before else:, got: #{inspect(line)}"
    end
  end

  defp rewrite_do_clause(lines, index, end_index, body_indent) do
    line = Enum.at(lines, index)
    body = clause_body(line, "do")

    if body == "" do
      {List.delete_at(lines, index), end_index - 1}
    else
      replacement = String.duplicate(" ", body_indent) <> body
      {List.replace_at(lines, index, replacement), end_index}
    end
  end

  defp rewrite_else_clause(lines, index, end_index, indent, body_indent) do
    line = Enum.at(lines, index)
    body = clause_body(line, "else")
    else_line = String.duplicate(" ", indent) <> "else"

    if body == "" do
      {List.replace_at(lines, index, else_line), end_index}
    else
      replacement = [else_line, String.duplicate(" ", body_indent) <> body]
      {List.replace_at(lines, index, replacement) |> List.flatten(), end_index + 1}
    end
  end

  defp clause_body(line, clause) do
    line
    |> String.trim_leading()
    |> String.replace_prefix("#{clause}:", "")
    |> String.trim_leading()
  end
end

RewriteWrappedInlineDo.main(System.argv())
