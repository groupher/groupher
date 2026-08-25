defmodule GroupherServer.Jobs.InteractionAudit do
  @moduledoc """
  Daily worker that verifies and repairs reaction bitmap projections.

  Business position:

      Oban cron -> InteractionAudit -> fact tables + bitmap repair
  """

  use Oban.Worker, queue: :default, max_attempts: 3

  alias GroupherServer.CMS.Interactions.Audit

  @impl Oban.Worker
  def perform(%Oban.Job{}) do
    case Audit.verify_and_repair() do
      {:ok, _result} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end
end
