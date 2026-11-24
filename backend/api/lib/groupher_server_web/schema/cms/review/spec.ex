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
    @desc "Review an article."
    value(:article)
    @desc "Review a comment."
    value(:comment)
  end

  input_object :artiment_review_target_input do
    @desc "Kind of content under review."
    field(:type, non_null(:artiment_review_target_type))
    @desc "Canonical path for an article target."
    field(:article, :article_path_input)
    @desc "Canonical path for a comment target."
    field(:comment, :comment_path_input)
    @desc "Stable ID of the target or containing article."
    field(:article_id, :id)
    @desc "Stable ID of the target comment."
    field(:comment_id, :id)
    @desc "ID of the community in which the target is reviewed."
    field(:community_id, :id)
  end

  object :artiment_review_opinion do
    @desc "Outcome recorded by this reviewer."
    field(:status, :string)
    @desc "Summary of the assessment."
    field(:summary, :string)
    @desc "Notes identifying suspicious content."
    field(:sus_notes, non_null(list_of(non_null(:sus_note))))
  end

  object :artiment_review_notice do
    @desc "Current notice status for the target."
    field(:status, non_null(:string))
    @desc "Machine-readable reason for a review failure."
    field(:failure_code, :string)
  end

  object :cms_artiment_review do
    @desc "ID of the review record."
    field(:artiment_review_id, :id)
    @desc "Kind of content reviewed."
    field(:target_type, non_null(:artiment_review_target_type))
    @desc "ID of the target or containing article."
    field(:article_id, :id)
    @desc "ID of the reviewed comment, when applicable."
    field(:comment_id, :id)
    @desc "Community in which the review applies."
    field(:community_id, :id)
    @desc "Current state of this review."
    field(:state, non_null(:string))
    @desc "When a newer review replaced this one."
    field(:replaced_at, :datetime)
    @desc "When this review ceased to match the target content."
    field(:outdated_at, :datetime)
    @desc "Machine-readable failure reason."
    field(:failure_code, :string)
    @desc "Explanation of a review failure."
    field(:failure_message, :string)
    @desc "Review mode used for the assessment."
    field(:review_mode, :string)
    @desc "Assessment from the system reviewer."
    field(:system_opinion, :artiment_review_opinion)
    @desc "Assessment from the community reviewer."
    field(:community_opinion, :artiment_review_opinion)
  end
end
