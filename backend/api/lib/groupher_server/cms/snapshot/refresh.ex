defmodule GroupherServer.CMS.Snapshot.Refresh do
  @moduledoc """
  Owns asynchronous and immediate snapshot refresh orchestration.

      event / Snapshot.Projection
        -> Snapshot.Refresh
        -> Snapshot.Query
        -> Snapshot.Cache

  Refresh is best-effort for enqueueing and never changes the caller's source
  relation set.
  """

  alias GroupherServer.CMS

  alias CMS.Snapshot.{Cache, Query}

  @type snapshot_kind :: :user | :article | :comment

  @doc "Enqueues a best-effort batch refresh outside test and seed environments."
  @spec refresh_async(snapshot_kind(), term(), keyword()) :: {:ok, :pass}
  def refresh_async(kind, refs, opts \\ []) when kind in [:user, :article, :comment] do
    if Application.get_env(:groupher_server, :env) in [:test, :seed_prod] do
      {:ok, :pass}
    else
      enqueue(kind, refs, opts)
    end
  end

  @doc "Loads and caches a batch immediately for the snapshot refresh job."
  @spec perform_refresh(snapshot_kind(), term(), keyword()) :: :ok | {:error, term()}
  def perform_refresh(:user, ids, opts) when is_list(ids) do
    :user
    |> Query.load_summaries(nil, ids)
    |> Cache.put_summaries(:user, nil, opts)
  end

  def perform_refresh(:article, %{thread: thread, ids: ids}, opts)
      when is_atom(thread) and is_list(ids) do
    :article
    |> Query.load_summaries(thread, ids)
    |> Cache.put_summaries(:article, thread, opts)
  end

  def perform_refresh(:comment, %{thread: thread, ids: ids}, opts)
      when is_atom(thread) and is_list(ids) do
    :comment
    |> Query.load_summaries(thread, ids)
    |> Cache.put_summaries(:comment, thread, opts)
  end

  def perform_refresh(_kind, _refs, _opts), do: :ok

  @doc "Enqueues only the cache misses discovered by stale-first projection."
  @spec enqueue_missing(snapshot_kind(), atom() | nil, [term()], keyword()) ::
          :ok | {:ok, :pass}
  def enqueue_missing(_kind, _thread, [], _opts), do: :ok

  def enqueue_missing(:user, _thread, ids, opts) do
    refresh_async(:user, Enum.reverse(ids), opts)
  end

  def enqueue_missing(kind, thread, ids, opts) when kind in [:article, :comment] do
    refresh_async(kind, %{thread: thread, ids: Enum.reverse(ids)}, opts)
  end

  defp enqueue(kind, refs, opts) do
    case GroupherServer.Jobs.snapshot_refresh(kind, refs, opts) do
      {:ok, _job} -> {:ok, :pass}
      {:error, _reason} -> {:ok, :pass}
    end
  rescue
    _ -> {:ok, :pass}
  end
end
