defmodule GroupherServer.CMS.Passport.Scope.CommunityGrant do
  @moduledoc """
  One subject's already loaded Community membership for a domain transaction.

      Command locks and authorizes -> CommunityGrant -> Passport Store CAS
  """
  @enforce_keys [:subject_id, :community_id, :member]
  defstruct [:subject_id, :community_id, :member]
end
