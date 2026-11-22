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
    @desc "Lists pending content reviews in a review scope."
    field :pending_artiment_reviews, non_null(list_of(non_null(:cms_artiment_review))) do
      arg(:scope, non_null(:review_bot_scope_input))
      arg(:limit, :integer, default_value: 50)
      arg(:offset, :integer, default_value: 0)
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.pending_artiment_reviews/3)
    end

    @desc "Loads the current review for a content target."
    field :artiment_review, :cms_artiment_review do
      arg(:target, non_null(:artiment_review_target_input))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.artiment_review/3)
    end

    @desc "Loads the review notice for a content target."
    field :artiment_review_notice, :artiment_review_notice do
      arg(:target, non_null(:artiment_review_target_input))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.artiment_review_notice/3)
    end

    @desc "Lists past reviews for a content target."
    field :artiment_review_history, non_null(list_of(non_null(:cms_artiment_review))) do
      arg(:target, non_null(:artiment_review_target_input))
      arg(:limit, :integer, default_value: 50)
      arg(:offset, :integer, default_value: 0)
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.artiment_review_history/3)
    end
  end
end
