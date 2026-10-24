defmodule GroupherServerWeb.Schema.CMS.Review.Types do
  @moduledoc """
  CMS-owned content review projections.

  Business position:

      CMS review resolver result
        -> content, opinion and target types
          -> GraphQL response
  """

  use Helper.GqlSchemaSuite

  input_object :cms_review_target_input do
    field(:type, non_null(:review_bot_subject_type))
    field(:article, :article_path_input)
    field(:comment, :comment_path_input)
    field(:article_id, :id)
    field(:comment_id, :id)
    field(:branch_id, :integer)
    field(:community_id, :id)
  end

  object :cms_review_opinion do
    field(:status, :string)
    field(:summary, :string)
    field(:sus_notes, non_null(list_of(non_null(:sus_note))))
  end

  object :cms_content_review do
    field(:artiment_review_id, :id)
    field(:target_type, non_null(:review_bot_subject_type))
    field(:article_id, :id)
    field(:comment_id, :id)
    field(:branch_id, :integer)
    field(:community_id, :id)
    field(:state, non_null(:string))
    field(:review_mode, :string)
    field(:system_opinion, :cms_review_opinion)
    field(:community_opinion, :cms_review_opinion)
  end
end
