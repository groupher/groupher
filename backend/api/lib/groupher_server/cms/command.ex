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

  Callers provide the action and its Confirmation codec together at execution
  time. The codec persists and recovers the exact command-time result; product
  projections remain outside this boundary.

  Operation atoms are encoded once at this boundary before reaching Receipt.
  The current release splits the first underscore into the namespace, except
  for the `doc_tree_` prefix, which becomes `doc.tree.` while preserving the
  remainder. For example, `:article_update_draft` becomes
  `"article.update_draft"` and `:doc_tree_create_tab` becomes
  `"doc.tree.create_tab"`.
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Command.Receipt, as: CommandReceipt
  alias CMS.ErrorCat

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
    confirmation = Keyword.fetch!(opts, :confirmation)
    presenter = Keyword.get(opts, :present)

    unless is_function(action, 1) and is_atom(confirmation) do
      raise ArgumentError,
            "CMS.Command.execute expects action/1 and a confirmation module"
    end

    unless is_nil(presenter) or is_function(presenter, 2) do
      raise ArgumentError,
            "CMS.Command.execute expects present/2 when a presenter is provided"
    end

    command_result =
      with {:ok, command_id} <- CommandReceipt.validate_command_id(command.command_id),
           :ok <- validate_target(command),
           :ok <- validate_confirmation(command.operation, confirmation) do
        with {:ok, {resource_type, resource_id}} <- target_identity(command) do
          context = context(command, command_id)

          receipt_args = [
            command.actor,
            command_id,
            operation_tag(command.operation),
            resource_type,
            resource_id,
            command.params,
            fn -> action.(context) end,
            confirmation
          ]

          if is_function(presenter, 2),
            do: apply(CommandReceipt, :execute, receipt_args ++ [presenter]),
            else: apply(CommandReceipt, :execute, receipt_args)
        end
      end

    normalize_command_result(command_result)
  end

  @doc "Encodes an operation atom into the canonical Receipt/Confirmation tag."
  @spec operation_tag(atom()) :: String.t()
  def operation_tag(operation) when is_atom(operation) do
    operation
    |> Atom.to_string()
    |> Macro.underscore()
    |> String.trim_leading("_")
    |> case do
      "doc_tree_" <> rest ->
        "doc.tree." <> rest

      value ->
        case String.split(value, "_", parts: 2) do
          [namespace, name] -> namespace <> "." <> name
          [name] -> name
        end
    end
  end

  defp validate_confirmation(operation, module) when is_atom(module) do
    try do
      with true <- Code.ensure_loaded?(module),
           true <- function_exported?(module, :operations, 0),
           true <- function_exported?(module, :encode, 2),
           true <- function_exported?(module, :decode, 2),
           operations when is_list(operations) <- module.operations(),
           true <- operation in operations do
        :ok
      else
        _ -> {:error, {:invalid_command_result, :confirmation_contract_unavailable}}
      end
    rescue
      _ -> {:error, {:invalid_command_result, :confirmation_contract_unavailable}}
    end
  end

  defp normalize_command_result({:error, {:invalid_command_result, _reason}}),
    do: {:error, ErrorCat.command_invalid_result()}

  defp normalize_command_result({:error, :invalid_intent_params}),
    do: {:error, ErrorCat.invalid_command_intent()}

  defp normalize_command_result(result), do: result

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

  @doc "Decodes a canonical Receipt operation tag without creating arbitrary atoms."
  @spec operation_from_tag(String.t()) :: {:ok, atom()} | {:error, :invalid_operation_tag}
  def operation_from_tag(tag) when is_binary(tag) do
    candidate =
      case String.split(tag, ".") do
        ["doc", "tree", rest] -> "doc_tree_" <> rest
        [namespace, name] -> namespace <> "_" <> name
        [name] -> name
        _ -> nil
      end

    if is_binary(candidate) do
      try do
        operation = String.to_existing_atom(candidate)

        if operation_tag(operation) == tag,
          do: {:ok, operation},
          else: {:error, :invalid_operation_tag}
      rescue
        ArgumentError -> {:error, :invalid_operation_tag}
      end
    else
      {:error, :invalid_operation_tag}
    end
  end

  def operation_from_tag(_tag), do: {:error, :invalid_operation_tag}

  defp target_identity(%__MODULE__{target: %{id: id, thread: thread}})
       when is_binary(id) and thread in [:post, :blog, :changelog, :doc],
       do: {:ok, {"article", id}}

  defp target_identity(%__MODULE__{target: target}) when is_struct(target) do
    build_target_identity(target, target_key(target))
  end

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
