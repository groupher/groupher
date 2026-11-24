defmodule GroupherServerWeb.Schema.CMS.CoAuthor.Spec do
  @moduledoc """
  Defines the public GraphQL shapes for Article co-author membership, requests, and viewer permissions.

      Article co-author domain results -> typed GraphQL values -> authorized client projection
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Fields

  enum :article_co_author_request_type do
    @desc "Invitation to collaborate on an article."
    value(:invite)
    @desc "Request to join an article as a co-author."
    value(:apply)
  end

  enum :article_co_author_request_status do
    @desc "Awaiting a decision."
    value(:pending)
    @desc "Accepted or rejected; see the decision field."
    value(:decided)
    @desc "Withdrawn before a decision."
    value(:cancelled)
    @desc "No longer actionable because its deadline passed."
    value(:expired)
  end

  enum :article_co_author_decision do
    @desc "Grant the agreed co-author permissions."
    value(:accept)
    @desc "Decline the proposed membership."
    value(:reject)
  end

  object :article_co_author do
    @desc "ID of the co-author membership, distinct from the user ID."
    field(:member_id, non_null(:id))
    @desc "Article covered by the grant."
    field(:article_id, non_null(:id))
    @desc "Current membership revision for permission changes."
    field(:revision, non_null(:integer))
    @desc "Article actions granted to this member."
    field(:permissions, non_null(list_of(non_null(:passport_action))))
    @desc "When the co-author membership began."
    field(:joined_at, non_null(:datetime))
    @desc "Account holding this membership."
    field(:user, non_null(:common_user))
  end

  object :article_co_author_page do
    @desc "Co-author memberships returned for this article page."
    field(:entries, non_null(list_of(non_null(:article_co_author))))
    pagi_fields()
  end

  object :article_co_author_request do
    @desc "ID of the co-author request."
    field(:id, non_null(:id))
    @desc "Article to which the request applies."
    field(:article_id, non_null(:id))
    @desc "Invitation or application."
    field(:type, non_null(:article_co_author_request_type))
    @desc "Current stage of the request."
    field(:status, non_null(:article_co_author_request_status))
    @desc "Recorded acceptance or rejection."
    field(:decision, :article_co_author_decision)
    @desc "Revision used when deciding or cancelling."
    field(:revision, non_null(:integer))
    @desc "Article actions requested for the prospective co-author."
    field(:proposed_permissions, non_null(:json))
    @desc "Article actions granted by the decision."
    field(:approved_permissions, :json)
    @desc "Deadline for deciding the request."
    field(:expires_at, non_null(:datetime))
    @desc "When the decision was recorded."
    field(:decided_at, :datetime)
    @desc "When the request was cancelled."
    field(:cancelled_at, :datetime)
    @desc "Prospective co-author."
    field(:subject_user, :common_user)
    @desc "Account that opened the request."
    field(:created_by, :common_user)
    @desc "Subject's current membership, when one exists."
    field(:current_member, :article_co_author)
  end

  object :article_co_author_request_page do
    @desc "Co-author invitations and applications on this page."
    field(:entries, non_null(list_of(non_null(:article_co_author_request))))
    pagi_fields()
  end

  object :article_permissions do
    @desc "Article evaluated for this viewer."
    field(:article_id, non_null(:id))
    @desc "Whether the viewer owns the article."
    field(:is_owner, non_null(:boolean))
    @desc "Article actions available to the viewer."
    field(:permissions, non_null(list_of(non_null(:passport_action))))
  end
end
