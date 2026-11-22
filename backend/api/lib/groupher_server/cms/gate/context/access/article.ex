defmodule GroupherServer.CMS.Gate.Context.Access.Article do
  @moduledoc """
  Authoritative facts for one ordinary Article mutation admission.

  Gate constructs this context from the canonical Article, its ArticleLifecycle,
  the ancestor Community facts, and current actor Passport rules. Doc resources
  use the separate Doc context because their Lifecycle is branch-scoped.

      Gate.access_check -> Article loader -> this context -> Article policy
  """

  @enforce_keys [:article, :article_lifecycle, :community, :community_lifecycle]
  defstruct [
    :article,
    :article_lifecycle,
    :community,
    :community_lifecycle,
    :passport_global_scope,
    :community_passport_scope,
    :article_passport_scope,
    :published_article_editable?,
    :published_article_editing_error,
    review_scope_keys: [],
    review_restricted?: false
  ]

  @type t :: %__MODULE__{
          article: struct(),
          article_lifecycle: struct(),
          community: struct(),
          community_lifecycle: struct(),
          passport_global_scope: struct() | nil,
          community_passport_scope: struct() | nil,
          article_passport_scope: struct() | nil,
          published_article_editable?: boolean() | nil,
          published_article_editing_error: term() | nil,
          review_scope_keys: [String.t()],
          review_restricted?: boolean()
        }
end
