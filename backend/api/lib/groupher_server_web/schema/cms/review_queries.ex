defmodule GroupherServerWeb.Schema.CMS.Review.Queries do
  @moduledoc """
  Read access to current CMS review work.

  Business position:

      GraphQL CMS review query
        -> pending/current review field
          -> CMS review resolver
  """

  use Helper.GqlSchemaSuite

  object :cms_review_queries do
    field :pending_content_reviews, non_null(list_of(non_null(:cms_content_review))) do
      arg(:scope, non_null(:review_bot_scope_input))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.pending_content_reviews/3)
    end

    field :content_review, :cms_content_review do
      arg(:target, non_null(:cms_review_target_input))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.content_review/3)
    end
  end
end
