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

  alias GroupherServer.CMS.Passport
  alias GroupherServer.CMS.Communities.ErrorCat

  @doc """
  Authorizes a reviewer map against a passport grant.

  ## Examples

      CMS.CommunityApplications.ReviewAuth.authorize(%User{id: 1}, "community_application_review")
      #=> :ok

      CMS.CommunityApplications.ReviewAuth.authorize(%User{id: 1}, "community_application_review")
      #=> {:error, CMS.Communities.ErrorCat.review_permission_denied()}

  """
  @spec authorize(map(), String.t()) :: :ok | {:error, GroupherServer.ErrorCat.Error.t()}
  def authorize(reviewer, grant) when is_map(reviewer) and is_binary(grant) do
    case Passport.check(reviewer, grant, %{}) do
      {:ok, true} -> :ok
      _ -> {:error, ErrorCat.review_permission_denied()}
    end
  end
end
