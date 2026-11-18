defmodule GroupherServer.CMS.Passport.Scope.ArticleGrant do
  @moduledoc """
  A subject's loaded Article membership for a domain-owned transaction.

      authorized command and locks -> ArticleGrant -> Passport Store CAS
  """
  @enforce_keys [:subject_id, :article_id, :member]
  defstruct [:subject_id, :article_id, :member]
end
