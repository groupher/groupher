defmodule GroupherServer.CMS.Communities.Jobs.ReleaseExpiredSlugClaims do
  @moduledoc """
  Repairs expired Application Slug Claims after their Application is terminal.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> ReleaseExpiredSlugClaims
        -> Repo / Oban
  """

  use Oban.Worker, queue: :community_application, max_attempts: 3

  alias GroupherServer.CMS

  @doc "Releases expired slug claims whose Application has reached a terminal state."
  @impl Oban.Worker
  def perform(_job) do
    {_count, nil} = CMS.Communities.release_expired_slug_claims(DateTime.utc_now(:second))
    :ok
  end
end
