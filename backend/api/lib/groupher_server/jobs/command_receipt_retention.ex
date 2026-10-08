defmodule GroupherServer.Jobs.CommandReceiptRetention do
  @moduledoc """
  Daily bounded cleanup for expired CMS command receipts.

      Oban cron -> CommandReceiptRetention -> cms.command_receipts
  """

  use Oban.Worker, queue: :default, max_attempts: 3

  alias GroupherServer.CMS

  alias CMS.Command.Receipt

  @batch_size 1_000
  @max_batches 100

  @impl Oban.Worker
  def perform(%Oban.Job{}) do
    processed = prune_batches(0, 0)

    :telemetry.execute(
      [:groupher, :cms, :command, :receipt_retention],
      %{processed: processed},
      %{batch_size: @batch_size, max_batches: @max_batches}
    )

    {:ok, :pass}
  end

  defp prune_batches(batch, processed) when batch >= @max_batches, do: processed

  defp prune_batches(batch, processed) do
    count = Receipt.prune_expired(@batch_size)

    if count < @batch_size do
      processed + count
    else
      prune_batches(batch + 1, processed + count)
    end
  end
end
