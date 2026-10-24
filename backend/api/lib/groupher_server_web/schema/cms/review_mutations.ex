defmodule GroupherServerWeb.Schema.CMS.Review.Mutations do
  @moduledoc """
  CMS resource decisions for current human review work.

  Business position:

      GraphQL human review mutation
        -> CMS review command field
          -> CMS review resolver
  """

  use Helper.GqlSchemaSuite

  object :cms_review_command_result do
    field(:command_id, non_null(:id))
    field(:target_type, non_null(:review_bot_subject_type))
    field(:target_id, non_null(:string))
    field(:action, non_null(:string))
  end

  object :cms_review_mutations do
    field :recheck_review_target, non_null(:cms_review_command_result) do
      arg(:target, non_null(:cms_review_target_input))
      arg(:scope, non_null(:review_bot_scope_input))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.recheck_content/3)
    end

    field :approve_article, non_null(:cms_review_command_result) do
      arg(:target, non_null(:cms_review_target_input))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.decide_content/3)
    end

    field :deny_article, non_null(:cms_review_command_result) do
      arg(:target, non_null(:cms_review_target_input))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.decide_content/3)
    end

    field :release_article, non_null(:cms_review_command_result) do
      arg(:target, non_null(:cms_review_target_input))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.decide_content/3)
    end

    field :approve_comment, non_null(:cms_review_command_result) do
      arg(:target, non_null(:cms_review_target_input))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.decide_content/3)
    end

    field :deny_comment, non_null(:cms_review_command_result) do
      arg(:target, non_null(:cms_review_target_input))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.decide_content/3)
    end

    field :release_comment, non_null(:cms_review_command_result) do
      arg(:target, non_null(:cms_review_target_input))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.decide_content/3)
    end

    field :approve_doc, non_null(:cms_review_command_result) do
      arg(:target, non_null(:cms_review_target_input))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.decide_content/3)
    end

    field :deny_doc, non_null(:cms_review_command_result) do
      arg(:target, non_null(:cms_review_target_input))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.decide_content/3)
    end

    field :release_doc, non_null(:cms_review_command_result) do
      arg(:target, non_null(:cms_review_target_input))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Review.decide_content/3)
    end
  end
end
