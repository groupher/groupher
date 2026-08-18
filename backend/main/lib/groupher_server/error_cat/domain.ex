defmodule GroupherServer.ErrorCat.Domain do
  @moduledoc "DSL used by a context-owned ErrorCat catalog."

  defmacro __using__(opts) do
    namespace_ast = Keyword.fetch!(opts, :namespace)
    {namespace, _binding} = Code.eval_quoted(namespace_ast, [], __CALLER__)
    validate_namespace!(namespace)

    quote do
      import GroupherServer.ErrorCat.Domain, only: [error: 1, error: 2]
      Module.register_attribute(__MODULE__, :error_cat_entries, accumulate: true)
      @error_cat_namespace unquote(Macro.escape(namespace))
      @before_compile GroupherServer.ErrorCat.Domain

      @doc false
      def namespace, do: @error_cat_namespace
    end
  end

  defmacro error(reason, opts \\ []) do
    caller = __CALLER__
    reason = Macro.expand(reason, caller)

    unless is_atom(reason) do
      raise ArgumentError, "ErrorCat reason must be an atom, got: #{Macro.to_string(reason)}"
    end

    opts = Macro.expand(opts, caller)
    code = Keyword.fetch!(opts, :code)
    retryable = Keyword.get(opts, :retryable, false)
    actions = Keyword.get(opts, :actions, [])
    message_key = Keyword.get(opts, :message_key)

    if Enum.any?(
         Module.get_attribute(caller.module, :error_cat_entries) || [],
         &(&1.reason == reason)
       ) do
      raise ArgumentError, "ErrorCat duplicate reason in catalog: #{inspect(reason)}"
    end

    validate_entry!(reason, code, retryable, actions, message_key)

    quote do
      @error_cat_entries %{
        reason: unquote(reason),
        code: unquote(code),
        retryable: unquote(retryable),
        actions: unquote(Macro.escape(actions)),
        message_key: unquote(message_key)
      }

      @doc false
      def unquote(reason)(details \\ nil) do
        %GroupherServer.ErrorCat.Error{
          namespace: @error_cat_namespace,
          reason: unquote(reason),
          code: unquote(code),
          retryable: unquote(retryable),
          actions: unquote(Macro.escape(actions)),
          message_key:
            unquote(message_key) ||
              GroupherServer.ErrorCat.Validator.default_message_key(
                @error_cat_namespace,
                unquote(reason)
              ),
          details: details
        }
      end
    end
  end

  defmacro __before_compile__(env) do
    namespace = Module.get_attribute(env.module, :error_cat_namespace)

    definitions =
      Module.get_attribute(env.module, :error_cat_entries)
      |> Enum.map(fn entry ->
        entry
        |> Map.put(:namespace, namespace)
        |> Map.update!(:message_key, &(&1 || GroupherServer.ErrorCat.Validator.default_message_key(namespace, entry.reason)))
      end)

    definition_clauses =
      Enum.map(definitions, fn definition ->
        quote do
          def definition(unquote(definition.reason)), do: unquote(Macro.escape(definition))
        end
      end)

    quote do
      @doc false
      def entries, do: unquote(Macro.escape(definitions))

      unquote_splicing(definition_clauses)

      @doc false
      def definition(reason) do
        raise ArgumentError,
              "unknown ErrorCat definition in #{inspect(@error_cat_namespace)}: #{inspect(reason)}"
      end
    end
  end

  defp validate_namespace!(namespace) when is_tuple(namespace) and tuple_size(namespace) > 0 do
    segments = Tuple.to_list(namespace)

    unless Enum.all?(segments, &is_atom/1) do
      raise ArgumentError, "ErrorCat namespace must contain atoms: #{inspect(namespace)}"
    end
  end

  defp validate_namespace!(namespace) do
    raise ArgumentError,
          "ErrorCat namespace must be a non-empty tuple, got: #{inspect(namespace)}"
  end

  defp validate_entry!(reason, code, retryable, actions, message_key) do
    unless is_integer(code) and code > 0 do
      raise ArgumentError, "ErrorCat #{inspect(reason)} code must be a positive integer"
    end

    unless is_boolean(retryable) do
      raise ArgumentError, "ErrorCat #{inspect(reason)} retryable must be boolean"
    end

    unless is_list(actions) and Enum.all?(actions, &is_atom/1) do
      raise ArgumentError, "ErrorCat #{inspect(reason)} actions must be a list of atoms"
    end

    if message_key != nil and not is_binary(message_key) do
      raise ArgumentError, "ErrorCat #{inspect(reason)} message_key must be a string"
    end
  end
end
