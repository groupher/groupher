defmodule Helper.Transaction do
  @moduledoc """
  Enhanced transaction utility providing:
  - Row-level locking for existing records
  - Global mutex for critical sections
  - Complete error stack capture
  - Automatic transaction management

  Business position:

      Domain or web caller
        -> Transaction
        -> normalized value / infrastructure
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
  alias GroupherServer.{ErrorCat, Repo}
  alias Helper.ORM.AdvisoryLock

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
    {:error, reason} -> {:error, normalize_error(reason)}
    other -> {:error, ErrorCat.custom(%{reason: :unexpected_error, details: other})}
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
    {:error, reason} -> {:error, normalize_error(reason)}
    other -> {:error, ErrorCat.custom(%{reason: :unexpected_error, details: other})}
  end

  @doc """
  Execute a critical section under a transaction-scoped global mutex.

  This uses PostgreSQL advisory transaction locks and is suitable for
  serializing business logic that is not tied to a single existing row.
  The lock is released automatically when the transaction ends.
  """
  @spec lock_global(binary() | integer(), (-> any())) :: {:ok, any()} | {:error, any()}
  def lock_global(lock_key, fun) when is_function(fun, 0) do
    AdvisoryLock.transact(lock_key, fn ->
      case fun.() do
        {:ok, result} -> result
        {:error, reason} -> throw({:error, reason})
        value -> value
      end
    end)
  catch
    {:error, reason} -> {:error, normalize_error(reason)}
    other -> {:error, ErrorCat.custom(%{reason: :unexpected_error, details: other})}
  end

  # Generates consistent sort key for queryable to prevent deadlocks
  defp resource_sort_key(%struct{} = queryable), do: {struct.__schema__(:source), queryable.id}

  # Generic queryable locking
  defp lock_queryable(queryable) do
    queryable.__struct__
    |> where(id: ^queryable.id)
    |> lock("FOR UPDATE")
    |> Repo.one!()
  rescue
    Ecto.NoResultsError ->
      throw(
        {:error, ErrorCat.custom(%{reason: :resource_not_found, resource: queryable.__struct__})}
      )
  end

  defp normalize_error(%ErrorCat.Error{} = error), do: error
  defp normalize_error(%GroupherServer.CMS.Gate.Decision{} = decision), do: decision
  defp normalize_error(%Ecto.Changeset{} = changeset), do: changeset
  defp normalize_error({:error, _step, reason, _changes}), do: normalize_error(reason)

  defp normalize_error(reason) do
    ErrorCat.custom(%{reason: :transaction_failed, details: reason})
  end
end
