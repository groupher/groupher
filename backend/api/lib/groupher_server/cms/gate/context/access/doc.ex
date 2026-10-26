defmodule GroupherServer.CMS.Gate.Context.Access.Doc do
  @moduledoc """
  Authoritative facts for one branch-scoped Doc mutation admission.

  The Gate Doc loader constructs this context with the canonical Doc, its
  selected DocBranch, branch-scoped DocLifecycle, ancestor Community facts,
  and current actor Passport rules. It is intentionally not interchangeable
  with Article access context.

      Gate.access_check -> Doc loader -> this context -> Doc policy
  """

  @enforce_keys [:doc, :doc_lifecycle, :doc_branch, :community, :community_lifecycle]
  defstruct [
    :doc,
    :doc_lifecycle,
    :doc_branch,
    :doc_branch_state,
    :community,
    :community_lifecycle,
    :passport_rules,
    review_scope_keys: [],
    review_restricted?: false
  ]

  @type t :: %__MODULE__{
          doc: struct(),
          doc_lifecycle: struct(),
          doc_branch: struct(),
          doc_branch_state: struct() | nil,
          community: struct(),
          community_lifecycle: struct(),
          passport_rules: map() | nil,
          review_scope_keys: [String.t()],
          review_restricted?: boolean()
        }
end
