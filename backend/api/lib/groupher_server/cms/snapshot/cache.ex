defmodule GroupherServer.CMS.Snapshot.Cache do
  @moduledoc """
  Owns snapshot cache keys, reads, and writes.

      Snapshot.Projection / Snapshot.Refresh
        -> Snapshot.Cache
        -> Helper.Cache

  Cache policy stays inside this module; callers work with summary maps and do
  not construct cache keys directly.
  """

  alias Helper.Cache, as: CacheStore

  @pool :snapshot
  @default_ttl_seconds 5 * 60

  @doc "Returns cached summaries and the identifiers that still need loading."
  @spec summaries(:user | :article | :comment, atom() | nil, [term()]) ::
          {map(), [term()]}
  def summaries(kind, thread, ids) do
    Enum.reduce(ids, {%{}, []}, fn id, {hits, misses} ->
      case CacheStore.get(@pool, cache_key(kind, thread, id)) do
        {:ok, summary} -> {Map.put(hits, id, summary), misses}
        _ -> {hits, [id | misses]}
      end
    end)
  end

  @doc "Stores summary maps using the configured or default snapshot TTL."
  @spec put_summaries(map(), :user | :article | :comment, atom() | nil, keyword()) ::
          {:ok, :pass}
  def put_summaries(summary_by_id, kind, thread, opts) when is_map(summary_by_id) do
    ttl_seconds = Keyword.get(opts, :ttl, @default_ttl_seconds)

    Enum.each(summary_by_id, fn {id, summary} ->
      CacheStore.put(@pool, cache_key(kind, thread, id), summary, expire_sec: ttl_seconds)
    end)

    {:ok, :pass}
  end

  defp cache_key(:user, _thread, id), do: "snapshot:user:#{id}"
  defp cache_key(:article, thread, id), do: "snapshot:article:#{thread}:#{id}"
  defp cache_key(:comment, thread, id), do: "snapshot:comment:#{thread}:#{id}"
end
