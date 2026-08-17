defmodule GroupherServer.CMS.Gate.Context.Access.Community do
  @moduledoc """
  Authoritative facts for one Community mutation admission.

  Gate's Community loader constructs this context after loading the canonical
  Community and its locked Lifecycle. The access policy consumes it; the
  context does not own Community state or actor identity.

      Gate.access_check -> Community loader -> this context -> policy
  """

  @enforce_keys [:community, :community_lifecycle]
  defstruct [:community, :community_lifecycle]

  @type t :: %__MODULE__{
          community: struct(),
          community_lifecycle: struct()
        }
end
