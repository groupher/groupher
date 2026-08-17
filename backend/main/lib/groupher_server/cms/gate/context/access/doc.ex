defmodule GroupherServer.CMS.Gate.Context.Access.Doc do
  @moduledoc """
  Authoritative facts for one branch-scoped Doc mutation admission.

  The Gate Doc loader constructs this context with the canonical Doc, its
  selected DocBranch, branch-scoped DocLifecycle, and ancestor Community facts.
  It is intentionally not interchangeable with Article access context.

      Gate.access_check -> Doc loader -> this context -> Doc policy
  """

  @enforce_keys [:doc, :doc_lifecycle, :doc_branch, :community, :community_lifecycle]
  defstruct [:doc, :doc_lifecycle, :doc_branch, :community, :community_lifecycle]

  @type t :: %__MODULE__{
          doc: struct(),
          doc_lifecycle: struct(),
          doc_branch: struct(),
          community: struct(),
          community_lifecycle: struct()
        }
end
