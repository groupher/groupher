defmodule GroupherServer.Jobs.CMSArtimentReviewRetention do
  @moduledoc """
  Daily cleanup of expired private CMS review inputs.

  Business position:

      Daily Oban schedule
        -> CMS review payload retention
          -> expired private inputs are cleared
  """

  use Oban.Worker, queue: :default, max_attempts: 3

  @batch_size 500
  @max_batches 100

  @impl Oban.Worker
  @doc """
  Clears expired private request payloads in bounded batches and records the count.

  ## Examples

      perform(%Oban.Job{})
  """
  def perform(%Oban.Job{}) do
    with {:ok, count} <- expire_batches(0, 0) do
      :telemetry.execute(
        [:groupher, :cms, :artiment_review, :retention],
        %{processed: count},
        %{batch_size: @batch_size, max_batches: @max_batches}
      )

      {:ok, :pass}
    end
  end

  defp expire_batches(batch, total) when batch >= @max_batches, do: {:ok, total}

  defp expire_batches(batch, total) do
    with {:ok, count} <- GroupherServer.CMS.expire_artiment_review_payloads(@batch_size) do
      if count < @batch_size do
        {:ok, total + count}
      else
        expire_batches(batch + 1, total + count)
      end
    end
  end
end
