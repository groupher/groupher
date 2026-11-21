defmodule GroupherServer.Jobs.ExpireCommunityAdminRequests do
  @moduledoc """
  Schedules expiry transitions for pending Community Admin requests.

  The bounded scan rechecks candidates under the Admin request lock plan;
  successful transitions write Activity and durable Notice intents atomically.

      Oban Cron -> ExpireDue -> locked request transition -> Outbox -> Notice
  """

  use Oban.Worker, queue: :community_application, max_attempts: 3

  alias GroupherServer.CMS

  @doc """
  Runs the bounded UTC expiry scan and returns failures to Oban for retry.

  ## Examples

      perform(%Oban.Job{})
  """
  @impl Oban.Worker
  def perform(_job) do
    case CMS.expire_community_admin_requests(DateTime.utc_now(:second)) do
      {:ok, _count} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end
end
