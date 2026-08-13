defmodule GroupherServer.CMS.CommunityApplications.Config do
  @moduledoc """
  Runtime policy values for the V1 application flow.

  Business position:

      Apply UI / reviewer
        -> GraphQL resolver
        -> CMS.CommunityApplications
        -> Config
        -> Repo / Oban
  """

  @spec submitted_ttl_days() :: pos_integer()
  def submitted_ttl_days do
    :groupher_server
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(:submitted_ttl_days, 30)
  end

  @spec logo_upload_ttl_seconds() :: pos_integer()
  def logo_upload_ttl_seconds do
    :groupher_server
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(:logo_upload_ttl_seconds, 15 * 60)
  end
end
