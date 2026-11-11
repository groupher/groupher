defmodule GroupherServer.Jobs.ArticleSnapshotCleanup do
  @moduledoc """
  Periodically removes expired, unselected ordinary Article Snapshots.

      Oban Cron -> ArticleSnapshotCleanup -> CMS.Articles snapshot retention
  """

  use Oban.Worker, queue: :default, max_attempts: 3

  @impl Oban.Worker
  @doc """
  Runs one bounded Article Snapshot cleanup batch.

  ## Examples

      perform(%Oban.Job{})
      #=> :ok
  """
  def perform(%Oban.Job{id: id, args: args}) do
    with {:ok, now, cursor} <- page_args(args),
         {:ok, page} <-
           GroupherServer.CMS.articles_cleanup_expired_snapshots_page(now: now, cursor: cursor),
         {:ok, :pass} <- enqueue_next(page.next_cursor, now, args["cycle_id"] || to_string(id)) do
      {:ok, :pass}
    end
  end

  defp page_args(%{"now" => now, "cursor_at" => captured_at, "cursor_id" => id})
       when is_binary(now) and is_binary(captured_at) and is_binary(id) do
    with {:ok, now, _} <- DateTime.from_iso8601(now),
         {:ok, captured_at, _} <- DateTime.from_iso8601(captured_at),
         {:ok, id} <- Ecto.UUID.cast(id) do
      {:ok, now, %{captured_at: captured_at, id: id}}
    else
      _ -> {:error, :invalid_snapshot_cleanup_cursor}
    end
  end

  defp page_args(args) when map_size(args) == 0, do: {:ok, DateTime.utc_now(), nil}
  defp page_args(_args), do: {:error, :invalid_snapshot_cleanup_cursor}

  defp enqueue_next(nil, _now, _cycle_id), do: {:ok, :pass}

  defp enqueue_next(cursor, now, cycle_id) do
    args = %{
      "now" => DateTime.to_iso8601(now),
      "cursor_at" => DateTime.to_iso8601(cursor.captured_at),
      "cursor_id" => cursor.id,
      "cycle_id" => cycle_id
    }

    unique = [
      period: :infinity,
      keys: [:cycle_id, :cursor_at, :cursor_id],
      states: [:available, :scheduled, :executing, :retryable, :completed]
    ]

    case args |> __MODULE__.new(unique: unique) |> Oban.insert() do
      {:ok, _job} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end
end
