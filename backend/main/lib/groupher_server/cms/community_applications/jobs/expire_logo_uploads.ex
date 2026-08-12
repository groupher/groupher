defmodule GroupherServer.CMS.CommunityApplications.Jobs.ExpireLogoUploads do
  @moduledoc "Marks unattached Application Logo uploads as expired."

  use Oban.Worker, queue: :community_application, max_attempts: 3

  alias GroupherServer.CMS

  @impl Oban.Worker
  def perform(_job) do
    {_count, nil} = CMS.CommunityApplications.expire_logo_uploads(DateTime.utc_now(:second))
    :ok
  end
end
