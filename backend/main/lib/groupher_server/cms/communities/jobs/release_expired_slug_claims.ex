defmodule GroupherServer.CMS.Communities.Jobs.ReleaseExpiredSlugClaims do
  @moduledoc "Repairs expired Application Slug Claims after their Application is terminal."

  use Oban.Worker, queue: :community_application, max_attempts: 3

  alias GroupherServer.CMS

  @impl Oban.Worker
  def perform(_job) do
    {_count, nil} = CMS.Communities.release_expired_slug_claims(DateTime.utc_now(:second))
    :ok
  end
end
