defmodule GroupherServer.CMS.CommunityApplications.Jobs.ExpireSubmitted do
  @moduledoc "Expires submitted Applications whose review window elapsed."

  use Oban.Worker, queue: :community_application, max_attempts: 3

  alias GroupherServer.CMS

  @impl Oban.Worker
  def perform(_job) do
    case CMS.CommunityApplications.expire_due(DateTime.utc_now(:second)) do
      {:ok, _count} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end
end
