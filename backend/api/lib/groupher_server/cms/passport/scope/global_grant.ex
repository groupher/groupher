defmodule GroupherServer.CMS.Passport.Scope.GlobalGrant do
  @moduledoc """
  A subject's already loaded Global authorization row for a domain transaction.

      Command locks and authorizes -> GlobalGrant -> Passport Store CAS
  """
  @enforce_keys [:subject_id, :current]
  defstruct [:subject_id, :current]
end
