defmodule GroupherServer.CMS.CommunityApplications.Jobs.ExpireLogoUploads do
  @moduledoc """
  Marks unattached Application Logo uploads as expired.

  Business position:

      Apply UI / reviewer
        -> GraphQL resolver
        -> CMS.CommunityApplications
        -> ExpireLogoUploads
        -> Repo / Oban
  """

  use Oban.Worker, queue: :community_application, max_attempts: 3

  alias GroupherServer.CMS

  @doc "Marks unattached Application Logo uploads as expired and cleans their objects."
  @impl Oban.Worker
  def perform(_job) do
    {_count, nil} = CMS.CommunityApplications.expire_logo_uploads(DateTime.utc_now(:second))
    :ok
  end
end
