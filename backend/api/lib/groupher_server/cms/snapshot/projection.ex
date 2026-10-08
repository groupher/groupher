defmodule GroupherServer.CMS.Snapshot.Projection do
  @moduledoc """
  Patches denormalized snapshot fields without changing binding membership.

      CMS.Snapshot facade
        -> Snapshot.Projection
        -> Snapshot.Cache / Snapshot.Query / Snapshot.Refresh

  Blocking mode reads authority immediately. Stale-first mode uses current
  cache hits and requests a background refresh for misses.
  """

  alias GroupherServer.CMS

  alias CMS.Snapshot.{Cache, Query, Refresh}

  @default_opts [mode: :stale_first]

  @doc "Patches a flat list of snapshots for one kind and optional thread."
  @spec resolve_many(:user | :article | :comment, atom() | nil, [map()], keyword()) :: [map()]
  def resolve_many(kind, thread, snapshots, opts) do
    summary_by_id = resolve_summary_by_id(kind, thread, snapshots, opts)

    Enum.map(snapshots, &patch_snapshot(&1, Map.get(summary_by_id, snapshot_id(kind, &1))))
  end

  @doc "Patches snapshot maps or lists found at the requested item paths."
  @spec resolve_in(
          :user | :article | :comment,
          atom() | nil,
          [map()],
          [atom() | [atom()]],
          keyword()
        ) :: [map()]
  def resolve_in(kind, thread, items, fields, opts) do
    paths = Enum.map(fields, &List.wrap/1)
    snapshots = collect_snapshots_from_items(items, paths)
    summary_by_id = resolve_summary_by_id(kind, thread, snapshots, opts)

    patch_items(kind, items, paths, summary_by_id)
  end

  defp resolve_summary_by_id(kind, thread, snapshots, opts) do
    opts = Keyword.merge(@default_opts, opts)
    ids = snapshots |> Enum.map(&snapshot_id(kind, &1)) |> Enum.reject(&is_nil/1) |> Enum.uniq()

    case Keyword.fetch!(opts, :mode) do
      :blocking ->
        kind
        |> Query.load_summaries(thread, ids)
        |> tap(&Cache.put_summaries(&1, kind, thread, opts))

      :stale_first ->
        {hits, misses} = Cache.summaries(kind, thread, ids)
        Refresh.enqueue_missing(kind, thread, misses, opts)
        hits
    end
  end

  defp collect_snapshots_from_items(items, paths) do
    Enum.flat_map(items, fn item ->
      Enum.flat_map(paths, fn path ->
        item
        |> get_nested(path)
        |> snapshot_values()
      end)
    end)
  end

  defp patch_items(kind, items, paths, summary_by_id) do
    Enum.map(items, fn item ->
      Enum.reduce(paths, item, fn path, acc ->
        case get_nested(acc, path) do
          value when is_list(value) ->
            put_nested(acc, path, Enum.map(value, &patch_snapshot_by_id(kind, &1, summary_by_id)))

          value when is_map(value) ->
            put_nested(acc, path, patch_snapshot_by_id(kind, value, summary_by_id))

          _ ->
            acc
        end
      end)
    end)
  end

  defp snapshot_values(value) when is_list(value), do: Enum.filter(value, &is_map/1)
  defp snapshot_values(value) when is_map(value), do: [value]
  defp snapshot_values(_value), do: []

  defp patch_snapshot_by_id(kind, snapshot, summary_by_id) do
    patch_snapshot(snapshot, Map.get(summary_by_id, snapshot_id(kind, snapshot)))
  end

  defp patch_snapshot(snapshot, nil), do: snapshot
  defp patch_snapshot(snapshot, summary) when is_map(snapshot), do: Map.merge(snapshot, summary)

  defp snapshot_id(:user, snapshot) when is_map(snapshot) do
    Map.get(snapshot, :id) || Map.get(snapshot, "id") || Map.get(snapshot, :user_id) ||
      Map.get(snapshot, "user_id")
  end

  defp snapshot_id(kind, snapshot) when kind in [:article, :comment] and is_map(snapshot) do
    Map.get(snapshot, :id) || Map.get(snapshot, "id")
  end

  defp snapshot_id(_kind, _snapshot), do: nil

  defp get_nested(data, path), do: get_in(data, Enum.map(path, &Access.key(&1)))
  defp put_nested(data, path, value), do: put_in(data, Enum.map(path, &Access.key(&1)), value)
end
