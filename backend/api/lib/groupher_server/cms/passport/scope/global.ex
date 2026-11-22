defmodule GroupherServer.CMS.Passport.Scope.Global do
  @moduledoc """
  Global authorization facts bound to the actor loaded by Passport.

      canonical actor -> Global scope -> Passport allowed?
  """
  @enforce_keys [:actor_id, :global]
  defstruct [:actor_id, :global]
end
