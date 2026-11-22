defmodule GroupherServerWeb.Schema.CMS.Review.Spec do
  @moduledoc """
  CMS-owned content review projections.

  Business position:

      CMS review resolver result
        -> content, opinion and target types
          -> GraphQL response
  """

  use Helper.GqlSchemaSuite

  enum :artiment_review_target_type do
    value(:article)
    value(:comment)
  end

  input_object :artiment_review_target_input do
    field(:type, non_null(:artiment_review_target_type))
    field(:article, :article_path_input)
    field(:comment, :comment_path_input)
    field(:article_id, :id)
    field(:comment_id, :id)
    field(:community_id, :id)
  end

  object :artiment_review_opinion do
    field(:status, :string)
    field(:summary, :string)
    field(:sus_notes, non_null(list_of(non_null(:sus_note))))
  end

  object :artiment_review_notice do
    field(:status, non_null(:string))
    field(:failure_code, :string)
  end

  object :cms_artiment_review do
    field(:artiment_review_id, :id)
    field(:target_type, non_null(:artiment_review_target_type))
    field(:article_id, :id)
    field(:comment_id, :id)
    field(:community_id, :id)
    field(:state, non_null(:string))
    field(:replaced_at, :datetime)
    field(:outdated_at, :datetime)
    field(:failure_code, :string)
    field(:failure_message, :string)
    field(:review_mode, :string)
    field(:system_opinion, :artiment_review_opinion)
    field(:community_opinion, :artiment_review_opinion)
  end
end
