defmodule GroupherServer.CMS.Command do
  @moduledoc """
  Public boundary for authenticated CMS user commands.

  A command declaration keeps the user intent together: actor, command id,
  command type, resource and business input. Receipt claim/finalize and the
  distinction between a first execution and a recovered result remain inside
  this module and its internal Receipt runner.

      domain command declaration
        -> CMS.Command
        -> Receipt claim / execute or result recovery
        -> canonical domain result

  Transport and UI callers provide only the normal execution function. A
  command owner may additionally provide a domain recovery projection when
  the canonical result cannot be reconstructed by the built-in resource
  recovery. That projection remains inside this boundary; no replay status is
  exposed to callers.

  Command atoms are encoded once at this boundary before reaching Receipt.
  The current release splits the first underscore into the namespace, except
  for the `doc_tree_` prefix, which becomes `doc.tree.` while preserving the
  remainder. For example, `:article_update_draft` becomes
  `"article.update_draft"` and `:doc_tree_create_tab` becomes
  `"doc.tree.create_tab"`.
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.{CommandReceipt, ErrorCat, FrontDesk}
  alias CMS.Model.Comment

  @doc "Resolves a transport command id before entering the user command boundary."
  defdelegate resolve_command_id(value), to: CommandReceipt

  @type t :: %__MODULE__{
          actor: User.t(),
          command_id: Ecto.UUID.t() | nil,
          command: atom(),
          resource: term(),
          owner: term(),
          input: term(),
          recovery: (term() -> term()) | nil,
          after_commit: (term() -> term()) | nil
        }

  defstruct [
    :actor,
    :command_id,
    :command,
    :resource,
    :owner,
    :input,
    :recovery,
    :after_commit
  ]

  @doc "Builds an authenticated user command declaration for an existing resource."
  @spec update_user(User.t(), Ecto.UUID.t(), keyword()) :: t()
  def update_user(%User{} = actor, command_id, opts) when is_list(opts) do
    %__MODULE__{
      actor: actor,
      command_id: command_id,
      command: Keyword.fetch!(opts, :command),
      resource: Keyword.fetch!(opts, :resource),
      input: Keyword.fetch!(opts, :input),
      recovery: Keyword.get(opts, :recovery),
      after_commit: Keyword.get(opts, :after_commit)
    }
  end

  @doc "Builds a user command for a create or other logical-scope operation."
  @spec create_user(User.t(), Ecto.UUID.t() | nil, keyword()) :: t()
  def create_user(%User{} = actor, command_id, opts) when is_list(opts) do
    %__MODULE__{
      actor: actor,
      command_id: command_id,
      command: Keyword.fetch!(opts, :command),
      resource: Keyword.get(opts, :resource),
      owner: Keyword.get(opts, :owner),
      input: Keyword.get(opts, :input),
      recovery: Keyword.get(opts, :recovery),
      after_commit: Keyword.get(opts, :after_commit)
    }
  end

  @doc "Runs one user command and returns its canonical domain result."
  @spec run(t(), (map() -> term())) :: {:ok, term()} | {:error, term()}
  def run(%__MODULE__{} = command, execute) when is_function(execute, 1) do
    with {:ok, command_id} <- CommandReceipt.resolve_command_id(command.command_id),
         :ok <- validate_target(command) do
      with {:ok, {target_type, target_key}} <- target_identity(command) do
        context = context(command, command_id)

        CommandReceipt.run_internal(
          command.actor,
          command_id,
          encode_command(command.command),
          target_type,
          target_key,
          command.input,
          fn -> execute.(context) end,
          &resolve_recovery(command, &1, context),
          command.after_commit || fn _result -> :ok end
        )
      end
    end
  end

  defp context(command, command_id) do
    command
    |> Map.from_struct()
    |> Map.take([:actor, :resource, :owner, :input])
    |> Map.put(:command_id, command_id)
  end

  defp validate_target(%__MODULE__{resource: resource}) when is_struct(resource), do: :ok

  defp validate_target(%__MODULE__{resource: resource, owner: owner})
       when not is_nil(resource) and not is_nil(owner),
       do: :ok

  defp validate_target(_), do: {:error, ErrorCat.unsupported_command_resource()}

  defp encode_command(command) when is_atom(command),
    do:
      command
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

  defp target_identity(%__MODULE__{resource: resource}) when is_struct(resource) do
    build_target_identity(resource, resource_key(resource))
  end

  defp target_identity(%__MODULE__{resource: resource, owner: owner}) do
    build_target_identity(resource, owner_key(owner))
  end

  defp build_target_identity(resource, key) when is_binary(key) or is_integer(key) do
    case resource_type(resource) do
      type when is_binary(type) -> {:ok, {type, key}}
      _ -> {:error, ErrorCat.unsupported_command_resource()}
    end
  end

  defp build_target_identity(_resource, _key),
    do: {:error, ErrorCat.unsupported_command_resource()}

  defp resource_type(resource) when is_atom(resource), do: Atom.to_string(resource)
  defp resource_type(resource) when is_binary(resource), do: resource

  defp resource_type(resource) when is_struct(resource),
    do: resource.__struct__ |> Module.split() |> List.last() |> Macro.underscore()

  defp resource_type(_resource), do: nil

  defp resource_key(resource) do
    Map.get(resource, :id) ||
      Map.get(resource, :article_hash_id) ||
      Map.get(resource, :hash_id) ||
      Map.get(resource, :inner_id)
  end

  defp owner_key(%{id: id}) when is_integer(id) or is_binary(id), do: id
  defp owner_key(%{slug: slug}) when is_binary(slug), do: slug
  defp owner_key(owner) when is_integer(owner), do: owner
  defp owner_key(owner) when is_binary(owner), do: owner
  defp owner_key(_owner), do: nil

  defp resolve_recovery(%__MODULE__{recovery: recovery}, receipt, _context)
       when is_function(recovery, 1),
       do: recovery.(receipt)

  defp resolve_recovery(%__MODULE__{resource: %Comment{} = resource}, receipt, context) do
    command_id = context.command_id

    with result_key when not is_nil(result_key) <- receipt.result_key,
         {:ok, comment_id} <- parse_result_key(result_key),
         {:ok, comment} <- FrontDesk.comment(comment_id),
         {:ok, article} <- FrontDesk.article_of(comment) do
      {:ok,
       comment
       |> Map.put(:article, %{
         thread: resource.thread,
         inner_id: article.inner_id,
         comments_count: article.comments_count,
         comments_revision: article.comments_revision
       })
       |> Map.put(:command_id, command_id)}
    else
      _ -> {:error, ErrorCat.command_result_unavailable()}
    end
  end

  defp resolve_recovery(_command, _receipt, _context),
    do: {:error, ErrorCat.command_result_unavailable()}

  defp parse_result_key(key) when is_integer(key), do: {:ok, key}

  defp parse_result_key(key) when is_binary(key) do
    case Integer.parse(key) do
      {value, ""} -> {:ok, value}
      _ -> :error
    end
  end

  defp parse_result_key(_), do: :error
end
