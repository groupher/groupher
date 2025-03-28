defmodule Helper.Transaction do
  @moduledoc """
  Enhanced transaction utility providing:
  - Multi-resource sequential locking
  - Complete error stack capture
  - Automatic transaction management
  """

  @doc """
  Lock resources and execute transaction (preserves detailed errors)

  ## Examples
      Transaction.locking([article, user], fn [locked_article, locked_user] ->
        # Business logic can return:
        # - {:ok, result}
        # - {:error, reason}
        # - raw value
      end)
  """

  import Ecto.Query, warn: false
  alias GroupherServer.Repo

  @spec locking(any() | [any()], (any() -> any())) :: {:ok, any()} | {:error, any()}
  def locking(resource, fun) when not is_list(resource) do
    try do
      Repo.transaction(fn ->
        locked = lock_resource(resource)

        case fun.(locked) do
          {:ok, result} -> result
          {:error, reason} -> throw({:error, reason})
          value -> value
        end
      end)
    catch
      {:error, reason} -> {:error, reason}
      other -> {:error, {:unexpected_error, other}}
    end
  end

  def locking(resources, fun) when is_list(resources) do
    try do
      Repo.transaction(fn ->
        locked_resources =
          resources
          |> Enum.sort_by(&resource_sort_key/1)
          |> Enum.map(&lock_resource/1)

        case fun.(locked_resources) do
          {:ok, result} -> result
          {:error, reason} -> throw({:error, reason})
          value -> value
        end
      end)
    catch
      {:error, reason} -> {:error, reason}
      other -> {:error, {:unexpected_error, other}}
    end
  end

  # Generates consistent sort key for resources to prevent deadlocks
  defp resource_sort_key(%struct{} = resource), do: {struct.__schema__(:source), resource.id}

  # Special locking for articles with inner_id (includes author preload)
  defp lock_resource(%{inner_id: _} = article) do
    article.__struct__
    |> where(id: ^article.id)
    |> preload(author: :user)
    |> lock("FOR UPDATE")
    |> Repo.one!()
  rescue
    Ecto.NoResultsError ->
      throw({:error, {:resource_not_found, article.__struct__}})
  end

  # Generic resource locking
  defp lock_resource(resource) do
    resource.__struct__
    |> where(id: ^resource.id)
    |> lock("FOR UPDATE")
    |> Repo.one!()
  rescue
    Ecto.NoResultsError ->
      throw({:error, {:resource_not_found, resource.__struct__}})
  end
end
