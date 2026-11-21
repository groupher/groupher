defmodule GroupherServer.CMS.Gate.Scope.ReviewRead do
  @moduledoc """
  Resolves the actor's current review-read grants for public Article, Doc, and Comment scopes.

  Scope query filters use these Passport facts only to admit content protected by
  matching active review restrictions; the surrounding Gate predicates still
  enforce resource and ancestor visibility.

      Passport Store
        -> ReviewRead grants -> Gate Scope restriction filters
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User

  @doc "Returns platform review access and Community ids authorized by current Passport rows."
  def grants(%User{} = actor) do
    case CMS.Passport.review_scope_grants(actor) do
      {:ok, grants} -> grants
      {:error, _reason} -> %{platform?: false, community_all?: false, community_ids: []}
    end
  rescue
    _ -> %{platform?: false, community_all?: false, community_ids: []}
  end

  def grants(_actor), do: %{platform?: false, community_all?: false, community_ids: []}
end
