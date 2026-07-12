defmodule GroupherServer.CMS.DocImport.StaticConfig do
  @moduledoc """
  Extracts static JavaScript or TypeScript object literals without executing
  repository code.

  The supported subset covers the common `defineConfig({...})` and
  `export default {...}` forms used by docs frameworks. Dynamic expressions are
  rejected so adapters can report a diagnostic and fall back safely.
  """

  @spec read(Path.t(), String.t()) :: {:ok, map()} | {:error, atom()}
  def read(path, anchor) do
    with {:ok, source} <- File.read(path),
         {:ok, object} <- extract_object(source, anchor),
         {:ok, quoted} <- object |> normalize() |> Code.string_to_quoted(emit_warnings: false),
         true <- Macro.quoted_literal?(quoted) do
      {:ok, from_ast(quoted)}
    else
      false -> {:error, :dynamic_config}
      {:error, %SyntaxError{}} -> {:error, :dynamic_config}
      {:error, _} = error -> error
    end
  rescue
    _ -> {:error, :dynamic_config}
  end

  @doc """
  Reads one static object/array property and resolves local zero-argument
  functions whose body is a single static `return` value.

  This covers docs configs such as `sidebar: { items: sidebarGuide() }`
  without evaluating the repository module.
  """
  @spec read_property(Path.t(), String.t()) :: {:ok, map() | list()} | {:error, atom()}
  def read_property(path, property) do
    with {:ok, source} <- File.read(path),
         {:ok, value} <- extract_property_value(source, property),
         {:ok, resolved} <- resolve_local_calls(value, source),
         {:ok, quoted} <- resolved |> normalize() |> Code.string_to_quoted(emit_warnings: false),
         true <- Macro.quoted_literal?(quoted) do
      {:ok, from_ast(quoted)}
    else
      false -> {:error, :dynamic_config}
      {:error, %SyntaxError{}} -> {:error, :dynamic_config}
      {:error, _reason} = error -> error
    end
  rescue
    _ -> {:error, :dynamic_config}
  end

  @doc """
  Reads an `export default { ... }` object with static local constant references.

  JSX values are reduced to their visible text before literal validation. This
  is intended for navigation labels only; no JSX or imported component runs.
  """
  @spec read_export(Path.t()) :: {:ok, map()} | {:error, atom()}
  def read_export(path) do
    with {:ok, source} <- File.read(path),
         {:ok, object} <- extract_object(source, "export default"),
         {:ok, resolved} <- resolve_local_constants(object, source),
         sanitized <- sanitize_jsx_values(resolved),
         {:ok, quoted} <- sanitized |> normalize() |> Code.string_to_quoted(emit_warnings: false),
         true <- Macro.quoted_literal?(quoted) do
      {:ok, from_ast(quoted)}
    else
      false -> {:error, :dynamic_config}
      {:error, %SyntaxError{}} -> {:error, :dynamic_config}
      {:error, _reason} = error -> error
    end
  rescue
    _ -> {:error, :dynamic_config}
  end

  defp extract_object(source, anchor) do
    with {anchor_start, anchor_length} <- :binary.match(source, anchor),
         start when not is_nil(start) <- find_open_brace(source, anchor_start + anchor_length) do
      take_balanced(source, start)
    else
      :nomatch -> {:error, :anchor_not_found}
      nil -> {:error, :object_not_found}
    end
  end

  defp extract_property_value(source, property) do
    pattern = ~r/(?:\b#{Regex.escape(property)}|["']#{Regex.escape(property)}["'])\s*:/

    case Regex.run(pattern, source, return: :index) do
      [{start, length}] ->
        source
        |> next_value_start(start + length)
        |> case do
          nil -> {:error, :property_value_not_found}
          value_start -> take_value(source, value_start)
        end

      nil ->
        {:error, :property_not_found}
    end
  end

  defp next_value_start(source, offset) do
    source
    |> binary_part(offset, byte_size(source) - offset)
    |> String.to_charlist()
    |> Enum.find_index(&(&1 in [?{, ?[]))
    |> case do
      nil -> nil
      relative -> offset + relative
    end
  end

  defp take_value(source, start) do
    opening = :binary.at(source, start)
    closing = if opening == ?{, do: ?}, else: ?]

    source
    |> binary_part(start, byte_size(source) - start)
    |> String.to_charlist()
    |> do_take_value(opening, closing, 0, nil, false, [])
  end

  defp do_take_value([], _opening, _closing, _depth, _quote, _escaped, _acc),
    do: {:error, :unclosed_value}

  defp do_take_value(
         [char | rest],
         opening,
         closing,
         depth,
         quote,
         escaped,
         acc
       )
       when not is_nil(quote) do
    cond do
      escaped -> do_take_value(rest, opening, closing, depth, quote, false, [char | acc])
      char == ?\\ -> do_take_value(rest, opening, closing, depth, quote, true, [char | acc])
      char == quote -> do_take_value(rest, opening, closing, depth, nil, false, [char | acc])
      true -> do_take_value(rest, opening, closing, depth, quote, false, [char | acc])
    end
  end

  defp do_take_value([char | rest], opening, closing, depth, nil, false, acc) do
    cond do
      char in [?", ?'] ->
        do_take_value(rest, opening, closing, depth, char, false, [char | acc])

      char == opening ->
        do_take_value(rest, opening, closing, depth + 1, nil, false, [char | acc])

      char == closing and depth == 1 ->
        {:ok, [char | acc] |> Enum.reverse() |> to_string()}

      char == closing ->
        do_take_value(rest, opening, closing, depth - 1, nil, false, [char | acc])

      true ->
        do_take_value(rest, opening, closing, depth, nil, false, [char | acc])
    end
  end

  defp resolve_local_calls(value, source) do
    ~r/\b([A-Za-z_$][\w$]*)\(\)/
    |> Regex.scan(value, capture: :all_but_first)
    |> List.flatten()
    |> Enum.uniq()
    |> Enum.reduce_while({:ok, value}, fn name, {:ok, current} ->
      case extract_function_return(source, name) do
        {:ok, returned} -> {:cont, {:ok, String.replace(current, "#{name}()", returned)}}
        {:error, _reason} -> {:halt, {:error, :dynamic_config}}
      end
    end)
  end

  defp resolve_local_constants(value, source) do
    constants =
      ~r/:\s*([A-Z][A-Z0-9_]*)\b/
      |> Regex.scan(value, capture: :all_but_first)
      |> List.flatten()
      |> Enum.uniq()

    Enum.reduce_while(constants, {:ok, value}, fn name, {:ok, current} ->
      case extract_object(source, "const #{name}") do
        {:ok, object} ->
          resolve_constant(object, source, name, current)

        {:error, _reason} ->
          {:halt, {:error, :dynamic_config}}
      end
    end)
  end

  defp resolve_constant(object, source, name, current) do
    case resolve_local_constants(object, source) do
      {:ok, resolved} ->
        next = Regex.replace(~r/(:\s*)#{Regex.escape(name)}\b/, current, "\\1#{resolved}")
        {:cont, {:ok, next}}

      {:error, _reason} ->
        {:halt, {:error, :dynamic_config}}
    end
  end

  defp sanitize_jsx_values(source) do
    Regex.replace(~r/:\s*<(.+?)>(?=\s*[,}])/s, source, fn _match, jsx ->
      text =
        "<#{jsx}>"
        |> String.replace(~r/<[^>]+>/, "")
        |> String.replace(~r/&[A-Za-z]+;/, " ")
        |> String.replace(~r/\s+/, " ")
        |> String.trim()

      ": " <> inspect(text)
    end)
  end

  defp extract_function_return(source, name) do
    pattern = ~r/function\s+#{Regex.escape(name)}\s*\([^)]*\)[^{]*\{/

    with [{function_start, function_length}] <- Regex.run(pattern, source, return: :index),
         function_tail <-
           binary_part(
             source,
             function_start + function_length,
             byte_size(source) - function_start - function_length
           ),
         {return_start, return_length} <- :binary.match(function_tail, "return"),
         value_start when not is_nil(value_start) <-
           next_value_start(function_tail, return_start + return_length) do
      take_value(function_tail, value_start)
    else
      _ -> {:error, :function_return_not_found}
    end
  end

  defp find_open_brace(source, offset) do
    source
    |> binary_part(offset, byte_size(source) - offset)
    |> :binary.match("{")
    |> case do
      {relative, 1} -> offset + relative
      :nomatch -> nil
    end
  end

  defp take_balanced(source, start) do
    source
    |> binary_part(start, byte_size(source) - start)
    |> String.to_charlist()
    |> do_take_balanced(0, nil, false, [])
  end

  defp do_take_balanced([], _depth, _quote, _escaped, _acc), do: {:error, :unclosed_object}

  defp do_take_balanced([char | rest], depth, quote, escaped, acc) when not is_nil(quote) do
    cond do
      escaped -> do_take_balanced(rest, depth, quote, false, [char | acc])
      char == ?\\ -> do_take_balanced(rest, depth, quote, true, [char | acc])
      char == quote -> do_take_balanced(rest, depth, nil, false, [char | acc])
      true -> do_take_balanced(rest, depth, quote, false, [char | acc])
    end
  end

  defp do_take_balanced([char | rest], depth, nil, false, acc) do
    cond do
      char in [?", ?'] -> do_take_balanced(rest, depth, char, false, [char | acc])
      char == ?{ -> do_take_balanced(rest, depth + 1, nil, false, [char | acc])
      char == ?} && depth == 1 -> {:ok, [char | acc] |> Enum.reverse() |> to_string()}
      char == ?} -> do_take_balanced(rest, depth - 1, nil, false, [char | acc])
      true -> do_take_balanced(rest, depth, nil, false, [char | acc])
    end
  end

  defp normalize(source) do
    source
    |> strip_comments()
    |> String.replace(~r/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/, "\\1\"\\2\" =>")
    |> String.replace(~r/([{,]\s*)(['\"])([^'\"]+)\2\s*:/, "\\1\\2\\3\\2 =>")
    |> String.replace(~r/\bnull\b/, "nil")
    |> prefix_maps()
  end

  defp strip_comments(source) do
    source
    |> String.to_charlist()
    |> do_strip_comments(:normal, false, [])
    |> Enum.reverse()
    |> to_string()
  end

  defp do_strip_comments([], _state, _escaped, acc), do: acc

  defp do_strip_comments([?/, ?/ | rest], :normal, _escaped, acc),
    do: do_strip_comments(rest, :line_comment, false, acc)

  defp do_strip_comments([?/, ?* | rest], :normal, _escaped, acc),
    do: do_strip_comments(rest, :block_comment, false, acc)

  defp do_strip_comments([?*, ?/ | rest], :block_comment, _escaped, acc),
    do: do_strip_comments(rest, :normal, false, acc)

  defp do_strip_comments([char | rest], :line_comment, _escaped, acc) when char in [?\n, ?\r],
    do: do_strip_comments(rest, :normal, false, [char | acc])

  defp do_strip_comments([_char | rest], state, _escaped, acc)
       when state in [:line_comment, :block_comment],
       do: do_strip_comments(rest, state, false, acc)

  defp do_strip_comments([char | rest], quote, true, acc) when quote in [?", ?'],
    do: do_strip_comments(rest, quote, false, [char | acc])

  defp do_strip_comments([?\\ = char | rest], quote, false, acc) when quote in [?", ?'],
    do: do_strip_comments(rest, quote, true, [char | acc])

  defp do_strip_comments([char | rest], char, false, acc) when char in [?", ?'],
    do: do_strip_comments(rest, :normal, false, [char | acc])

  defp do_strip_comments([char | rest], quote, false, acc) when quote in [?", ?'],
    do: do_strip_comments(rest, quote, false, [char | acc])

  defp do_strip_comments([char | rest], :normal, false, acc) when char in [?", ?'],
    do: do_strip_comments(rest, char, false, [char | acc])

  defp do_strip_comments([char | rest], :normal, false, acc),
    do: do_strip_comments(rest, :normal, false, [char | acc])

  defp prefix_maps(source) do
    source
    |> String.to_charlist()
    |> Enum.reduce({[], nil, false}, &prefix_map_char/2)
    |> elem(0)
    |> Enum.reverse()
    |> to_string()
  end

  defp prefix_map_char(char, {acc, quote, true}) when not is_nil(quote),
    do: {[char | acc], quote, false}

  defp prefix_map_char(?\\ = char, {acc, quote, false}) when not is_nil(quote),
    do: {[char | acc], quote, true}

  defp prefix_map_char(char, {acc, char, false}) when char in [?", ?'],
    do: {[char | acc], nil, false}

  defp prefix_map_char(char, {acc, quote, false}) when not is_nil(quote),
    do: {[char | acc], quote, false}

  defp prefix_map_char(char, {acc, nil, false}) when char in [?", ?'],
    do: {[char | acc], char, false}

  defp prefix_map_char(?{, {acc, nil, false}), do: {[?{, ?% | acc], nil, false}
  defp prefix_map_char(char, {acc, nil, false}), do: {[char | acc], nil, false}

  defp from_ast({:%{}, _, entries}) do
    order = Enum.map(entries, fn {key, _value} -> to_string(from_ast(key)) end)

    entries
    |> Map.new(fn {key, value} -> {to_string(from_ast(key)), from_ast(value)} end)
    |> Map.put("__order__", order)
  end

  defp from_ast(value) when is_list(value) do
    if value != [] and Enum.all?(value, &is_integer/1) and List.ascii_printable?(value) do
      to_string(value)
    else
      Enum.map(value, &from_ast/1)
    end
  end

  defp from_ast(value), do: value
end
