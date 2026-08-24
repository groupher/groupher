defmodule GroupherServer.CMS.Gate.Context.Access.Comment do
  @moduledoc """
  Authoritative facts for one Comment mutation admission.

  Gate constructs this context from the CommentLifecycle and the parent Article
  and Community facts. Parent state remains inherited capability, not copied
  Comment state.

      Gate.access_check -> Comment loader -> this context -> Comment policy

  Solution authorization uses the canonical parent facts carried here rather
  than asking a Command to preload or query the Post again:

      canonical Post -> author user id + category -> solution policy
  """

  @enforce_keys [
    :comment,
    :comment_lifecycle,
    :article,
    :article_lifecycle,
    :community,
    :community_lifecycle
  ]
  defstruct [
    :comment,
    :comment_lifecycle,
    :article,
    :article_lifecycle,
    :article_author_user_id,
    :article_cat,
    :community,
    :community_lifecycle
  ]

  @type t :: %__MODULE__{
          comment: struct(),
          comment_lifecycle: struct(),
          article: struct(),
          article_lifecycle: struct(),
          article_author_user_id: integer() | nil,
          article_cat: atom() | nil,
          community: struct(),
          community_lifecycle: struct()
        }
end
