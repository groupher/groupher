defmodule Helper.Transaction do
  @moduledoc """
  Enhanced transaction utility providing:
  - Multi-queryable sequential locking
  - Complete error stack capture
  - Automatic transaction management
  """

  @doc """
  Lock queryable and execute transaction (preserves detailed errors)

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
  def locking(queryable, fun) when not is_list(queryable) do
    try do
      Repo.transaction(fn ->
        locked = lock_queryable(queryable)

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

  def locking(queryable, fun) when is_list(queryable) do
    try do
      Repo.transaction(fn ->
        locked_resources =
          queryable
          |> Enum.sort_by(&resource_sort_key/1)
          |> Enum.map(&lock_queryable/1)

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

  # Generates consistent sort key for queryable to prevent deadlocks
  defp resource_sort_key(%struct{} = queryable), do: {struct.__schema__(:source), queryable.id}

  # Special locking for articles with inner_id (includes author preload)
  defp lock_queryable(%{inner_id: _} = article) do
    article.__struct__
    |> where(id: ^article.id)
    |> preload([:communities, author: :user])
    |> lock("FOR UPDATE")
    |> Repo.one!()
  rescue
    Ecto.NoResultsError ->
      throw({:error, {:resource_not_found, article.__struct__}})
  end

  # Generic queryable locking
  defp lock_queryable(queryable) do
    queryable.__struct__
    |> where(id: ^queryable.id)
    |> lock("FOR UPDATE")
    |> Repo.one!()
  rescue
    Ecto.NoResultsError ->
      throw({:error, {:resource_not_found, queryable.__struct__}})
  end
end
