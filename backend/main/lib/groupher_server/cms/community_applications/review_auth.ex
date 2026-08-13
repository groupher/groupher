defmodule GroupherServer.CMS.CommunityApplications.ReviewAuth do
  @moduledoc """
  Defense-in-depth global permission check for reviewer facades.

  Business position:

      Apply UI / reviewer
        -> GraphQL resolver
        -> CMS.CommunityApplications
        -> ReviewAuth
        -> Repo / Oban
  """

  alias GroupherServer.CMS.Gate

  @spec authorize(map(), String.t()) :: :ok | {:error, atom()}
  def authorize(reviewer, grant) when is_map(reviewer) and is_binary(grant) do
    case Gate.check_passport(reviewer, grant, %{}) do
      {:ok, true} -> :ok
      _ -> {:error, :review_permission_denied}
    end
  end
end
