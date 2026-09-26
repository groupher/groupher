defmodule GroupherServer.CMS.ViewTracker.Retention do
  @moduledoc """
  Deletes expired ViewTracker transport and dedupe state in bounded batches.

      Oban cron
        -> Retention.delete_expired/0
        -> expired ViewCountReceipt rows
        -> stale ViewWatermark rows

  Receipt expiry is a cleanup boundary. A receipt that has expired but has not
  yet been deleted still returns its finalized decision. Watermarks are kept
  longer than every actor dedupe window, so cleanup cannot reopen a live window.
  """

  import Ecto.Query

  alias GroupherServer.Repo
  alias GroupherServer.CMS.ViewTracker.Config
  alias GroupherServer.CMS.ViewTracker.Model.{ViewCountReceipt, ViewWatermark}

  @doc "Deletes at most one configured batch from each retained table."
  @spec delete_expired() :: %{receipts: non_neg_integer(), watermarks: non_neg_integer()}
  def delete_expired do
    %{
      receipts: delete_expired_receipts(),
      watermarks: delete_expired_watermarks()
    }
  end

  defp delete_expired_receipts do
    ids =
      from(receipt in ViewCountReceipt,
        where: receipt.expires_at <= fragment("clock_timestamp()"),
        order_by: [asc: receipt.expires_at, asc: receipt.event_id],
        limit: ^Config.retention_batch_size(),
        select: receipt.event_id
      )
      |> Repo.all()

    {count, _} =
      Repo.delete_all(from(receipt in ViewCountReceipt, where: receipt.event_id in ^ids))

    count
  end

  defp delete_expired_watermarks do
    seconds = Config.watermark_retention_seconds()

    keys =
      from(watermark in ViewWatermark,
        where:
          watermark.last_counted_at <
            fragment("clock_timestamp() - (? * interval '1 second')", ^seconds),
        order_by: [asc: watermark.last_counted_at],
        limit: ^Config.retention_batch_size(),
        select: {watermark.thread, watermark.article_id, watermark.viewer_tracking_key}
      )
      |> Repo.all()

    predicate =
      Enum.reduce(keys, dynamic(false), fn {thread, article_id, tracking_key}, predicate ->
        dynamic(
          [watermark],
          ^predicate or
            (watermark.thread == ^thread and watermark.article_id == ^article_id and
               watermark.viewer_tracking_key == ^tracking_key)
        )
      end)

    {count, _} =
      Repo.delete_all(
        from(watermark in ViewWatermark,
          where: ^predicate,
          where:
            watermark.last_counted_at <
              fragment("clock_timestamp() - (? * interval '1 second')", ^seconds)
        )
      )

    count
  end
end
