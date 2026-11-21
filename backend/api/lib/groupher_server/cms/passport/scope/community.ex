defmodule GroupherServer.CMS.Passport.Scope.Community do
  @moduledoc """
  Loaded Passport facts bound to one actor and one canonical Community.

      Gate loader -> Community scope facts -> Passport allowed?
  """
  @enforce_keys [:actor_id, :community_id, :global, :community]
  defstruct [:actor_id, :community_id, :global, :community]

  @type t :: %__MODULE__{}
end
