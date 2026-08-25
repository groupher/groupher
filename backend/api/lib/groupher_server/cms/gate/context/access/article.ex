defmodule GroupherServer.CMS.Gate.Context.Access.Article do
  @moduledoc """
  Authoritative facts for one ordinary Article mutation admission.

  Gate constructs this context from the canonical Article, its ArticleLifecycle,
  and the ancestor Community facts. Doc resources use the separate Doc context
  because their Lifecycle is branch-scoped.

      Gate.access_check -> Article loader -> this context -> Article policy
  """

  @enforce_keys [:article, :article_lifecycle, :community, :community_lifecycle]
  defstruct [:article, :article_lifecycle, :community, :community_lifecycle]

  @type t :: %__MODULE__{
          article: struct(),
          article_lifecycle: struct(),
          community: struct(),
          community_lifecycle: struct()
        }
end
