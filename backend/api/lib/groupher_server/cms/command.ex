defmodule GroupherServer.CMS.Command do
  @moduledoc """
  Public boundary for authenticated CMS user commands.

  A command request keeps the user intent together: actor, command id,
  operation, target and business params. Receipt claim/finalize and the
  distinction between a first execution and a recovered result remain inside
  this module and its internal Receipt runner.

      domain command declaration
        -> CMS.Command
        -> Receipt claim / execute or result recovery
        -> canonical domain result

  Callers provide the action and result projection together at execution time.
  The same projection runs after first execution and after a
  completed receipt is claimed again, so callers always receive one canonical
  business result and never a replay status.

  Operation atoms are encoded once at this boundary before reaching Receipt.
  The current release splits the first underscore into the namespace, except
  for the `doc_tree_` prefix, which becomes `doc.tree.` while preserving the
  remainder. For example, `:article_update_draft` becomes
  `"article.update_draft"` and `:doc_tree_create_tab` becomes
  `"doc.tree.create_tab"`.
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.{CommandReceipt, ErrorCat}

  @type t :: %__MODULE__{
          actor: User.t(),
          command_id: Ecto.UUID.t(),
          operation: atom(),
          target: term(),
          params: term()
        }

  @enforce_keys [:actor, :command_id, :operation, :target, :params]
  defstruct [:actor, :command_id, :operation, :target, :params]

  @doc "Runs one user command and returns its canonical domain result."
  @spec execute(t(), keyword()) :: {:ok, term()} | {:error, term()}
  def execute(%__MODULE__{} = command, opts) when is_list(opts) do
    action = Keyword.fetch!(opts, :action)
    result = Keyword.fetch!(opts, :result)

    unless is_function(action, 1) and is_function(result, 1) do
      raise ArgumentError, "CMS.Command.execute expects action/1 and result/1 functions"
    end

    with {:ok, command_id} <- CommandReceipt.validate_command_id(command.command_id),
         :ok <- validate_target(command) do
      with {:ok, {resource_type, resource_id}} <- target_identity(command) do
        context = context(command, command_id)

        CommandReceipt.run_internal(
          command.actor,
          command_id,
          encode_operation(command.operation),
          resource_type,
          resource_id,
          command.params,
          fn -> action.(context) end,
          result
        )
      end
    end
  end

  defp context(command, command_id) do
    command
    |> Map.from_struct()
    |> Map.take([:actor, :target, :params])
    |> Map.put(:command_id, command_id)
  end

  defp validate_target(%__MODULE__{target: target}) when is_struct(target), do: :ok

  defp validate_target(%__MODULE__{target: %{id: id, thread: thread}})
       when is_binary(id) and thread in [:post, :blog, :changelog, :doc],
       do: :ok

  defp validate_target(%__MODULE__{target: {type, id}})
       when (is_atom(type) or is_binary(type)) and (is_binary(id) or is_integer(id)),
       do: :ok

  defp validate_target(_), do: {:error, ErrorCat.unsupported_command_resource()}

  defp encode_operation(operation) when is_atom(operation),
    do:
      operation
      |> Atom.to_string()
      |> Macro.underscore()
      |> String.replace_prefix("_", "")
      |> split_command()

  defp split_command(command) do
    case command do
      "doc_tree_" <> rest -> "doc.tree." <> rest
      _ -> split_command_namespace(command)
    end
  end

  defp split_command_namespace(command) do
    case String.split(command, "_", parts: 2) do
      [namespace, name] -> namespace <> "." <> name
      [name] -> name
    end
  end

  defp target_identity(%__MODULE__{target: target}) when is_struct(target) do
    build_target_identity(target, target_key(target))
  end

  defp target_identity(%__MODULE__{target: %{id: id, thread: thread}})
       when is_binary(id) and thread in [:post, :blog, :changelog, :doc],
       do: {:ok, {"article", id}}

  defp target_identity(%__MODULE__{target: {type, id}}),
    do: {:ok, {target_type(type), id}}

  defp build_target_identity(target, key) when is_binary(key) or is_integer(key) do
    case target_type(target) do
      type when is_binary(type) -> {:ok, {type, key}}
      _ -> {:error, ErrorCat.unsupported_command_resource()}
    end
  end

  defp build_target_identity(_target, _key),
    do: {:error, ErrorCat.unsupported_command_resource()}

  defp target_type(target) when is_atom(target), do: Atom.to_string(target)
  defp target_type(target) when is_binary(target), do: target

  defp target_type(target) when is_struct(target),
    do: target.__struct__ |> Module.split() |> List.last() |> Macro.underscore()

  defp target_type(_target), do: nil

  defp target_key(target) do
    Map.get(target, :id) ||
      Map.get(target, :hash_id) ||
      Map.get(target, :inner_id)
  end
end
