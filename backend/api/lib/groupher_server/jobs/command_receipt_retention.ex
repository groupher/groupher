defmodule GroupherServer.Jobs.CommandReceiptRetention do
  @moduledoc """
  Daily bounded cleanup for expired CMS command receipts.

      Oban cron -> CommandReceiptRetention -> cms.command_receipts
  """

  use Oban.Worker, queue: :default, max_attempts: 3

  alias GroupherServer.CMS

  alias CMS.CommandReceipt

  @impl Oban.Worker
  def perform(%Oban.Job{}) do
    _deleted = CommandReceipt.prune_expired()
    :ok
  end
end
