defmodule Helper.Transaction do
  @moduledoc """
  Enhanced transaction utility providing:
  - Row-level locking for existing records
  - Global mutex for critical sections
  - Complete error stack capture
  - Automatic transaction management
  """

  @doc """
  Lock one or more existing rows with `FOR UPDATE` and execute transaction.

  Use this when updating records that already exist.

  ## Examples
      Transaction.lock_row([article, user], fn [locked_article, locked_user] ->
        # Business logic can return:
        # - {:ok, result}
        # - {:error, reason}
        # - raw value
      end)
  """

  import Ecto.Query, warn: false
  alias GroupherServer.Repo

  @spec lock_row(any() | [any()], (any() -> any())) :: {:ok, any()} | {:error, any()}
  def lock_row(queryable, fun) when not is_list(queryable) do
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

  def lock_row(queryable, fun) when is_list(queryable) do
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

  @doc """
  Execute a critical section under a transaction-scoped global mutex.

  This uses PostgreSQL advisory transaction locks and is suitable for
  serializing business logic that is not tied to a single existing row.
  The lock is released automatically when the transaction ends.
  """
  @spec lock_global(binary() | integer(), (-> any())) :: {:ok, any()} | {:error, any()}
  def lock_global(lock_key, fun) when is_function(fun, 0) do
    key = normalize_lock_key(lock_key)

    Repo.transaction(fn ->
      Repo.query!("SELECT pg_advisory_xact_lock($1)", [key])

      case fun.() do
        {:ok, result} -> result
        {:error, reason} -> throw({:error, reason})
        value -> value
      end
    end)
  catch
    {:error, reason} -> {:error, reason}
    other -> {:error, {:unexpected_error, other}}
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

  defp normalize_lock_key(lock_key) when is_integer(lock_key), do: lock_key

  defp normalize_lock_key(lock_key) when is_binary(lock_key) do
    <<key::signed-64, _::binary>> = :crypto.hash(:sha256, lock_key)
    key
  end
end
