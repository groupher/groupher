defmodule GroupherServer.CMS.Gate.Context.Access.Doc do
  @moduledoc """
  Authoritative facts for one site-owned Doc mutation admission.

  The Gate Doc loader constructs this context with the canonical Doc, its
  shared ArticleLifecycle, ancestor Community facts,
  and current actor Passport rules. It is intentionally not interchangeable
  with Article access context.

      Gate.access_check -> Doc loader -> this context -> Doc policy
  """

  @enforce_keys [:doc, :doc_lifecycle, :community, :community_lifecycle]
  defstruct [
    :doc,
    :doc_lifecycle,
    :community,
    :community_lifecycle,
    :passport_global_scope,
    :community_passport_scope,
    :public_available?,
    trashed?: false,
    review_scope_keys: [],
    review_restricted?: false
  ]

  @type t :: %__MODULE__{
          doc: struct(),
          doc_lifecycle: struct(),
          community: struct(),
          community_lifecycle: struct(),
          passport_global_scope: struct() | nil,
          community_passport_scope: struct() | nil,
          trashed?: boolean(),
          review_scope_keys: [String.t()],
          review_restricted?: boolean()
        }
end
