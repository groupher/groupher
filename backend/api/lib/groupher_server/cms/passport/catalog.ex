defmodule GroupherServer.CMS.Passport.Catalog do
  @moduledoc """
  Reads the generated permission contract and validates a resource's grant map.

      Contract -> Catalog -> Passport Store -> resource admission
  """

  alias GroupherServer.CMS
  alias CMS.GateAction

  @scopes [:global, :community, :article]

  @doc "Lists canonical permissions and metadata for a supported scope."
  def list(scope) when scope in @scopes do
    entries =
      GateAction.actions()
      |> Enum.flat_map(fn action ->
        case GateAction.metadata(action) do
          %{scope: ^scope} = metadata -> [%{action: action, metadata: metadata}]
          _ -> []
        end
      end)

    {:ok, entries}
  end

  def list(_), do: {:error, :invalid_scope}

  @doc "Returns the canonical metadata for a registered action."
  def get(action) when is_binary(action) do
    case GateAction.metadata(action) do
      nil -> {:error, :unknown_action}
      metadata -> {:ok, metadata}
    end
  end

  def get(_), do: {:error, :unknown_action}

  @doc "Combines the registered static requirements with the actual thread requirements."
  def requirements(action, thread \\ nil) do
    with {:ok, metadata} <- get(action),
         {:ok, thread_key} <- validate_thread(thread) do
      thread_requirements =
        if thread_key, do: Map.get(metadata.requires_thread, thread_key, []), else: []

      {:ok, Enum.uniq(metadata.requires ++ thread_requirements)}
    end
  end

  defp validate_thread(nil), do: {:ok, nil}
  defp validate_thread(thread) when is_atom(thread), do: validate_thread(Atom.to_string(thread))

  defp validate_thread(thread) when is_binary(thread) do
    if thread in GateAction.threads(), do: {:ok, thread}, else: {:error, :unknown_thread}
  end

  defp validate_thread(_), do: {:error, :unknown_thread}

  @doc "Validates and normalizes an ordinary grant map in one resource scope."
  def validate_permissions(scope, permissions) when scope in @scopes and is_map(permissions) do
    with {:ok, normalized} <- normalize(scope, permissions),
         {:ok, :pass} <- validate_dependencies(normalized) do
      {:ok, normalized}
    end
  end

  def validate_permissions(_, _), do: {:error, :invalid_permissions}

  defp normalize(scope, permissions) do
    Enum.reduce_while(permissions, {:ok, %{}}, fn {action, value}, {:ok, acc} ->
      case get(action) do
        {:ok, %{scope: ^scope, grantable: true}} when is_boolean(value) ->
          {:cont, {:ok, if(value, do: Map.put(acc, action, true), else: acc)}}

        {:ok, %{scope: ^scope, grantable: true}} ->
          {:halt, {:error, :invalid_permission_value}}

        {:ok, %{scope: ^scope, grantable: false}} ->
          {:halt, {:error, :permission_not_grantable}}

        {:ok, _metadata} ->
          {:halt, {:error, :permission_scope_mismatch}}

        {:error, _reason} = error ->
          {:halt, error}
      end
    end)
  end

  defp validate_dependencies(permissions) do
    missing =
      Enum.find_value(permissions, fn {action, true} ->
        {:ok, metadata} = get(action)
        Enum.find(metadata.requires, &(Map.get(permissions, &1) != true))
      end)

    if missing, do: {:error, :permission_dependency_missing}, else: {:ok, :pass}
  end
end
