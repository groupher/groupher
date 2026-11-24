defmodule GroupherServerWeb.Schema.CMS.Admin.Spec do
  @moduledoc """
  GraphQL types for Passport-backed Community Admin membership and requests.

      Community Admin rows / requests -> typed membership and request GraphQL values
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Fields

  object :community_admin do
    @desc "ID of the admin membership, distinct from the user ID."
    field(:member_id, non_null(:id))
    @desc "Current membership revision for permission changes."
    field(:revision, non_null(:integer))
    @desc "Whether the member holds the community lord role."
    field(:is_lord, non_null(:boolean))
    @desc "Passport actions granted to this member."
    field(:permissions, non_null(list_of(non_null(:passport_action))))
    @desc "Account holding the membership."
    field(:user, non_null(:common_user))
  end

  object :community_admin_page do
    @desc "Admin memberships returned for this page."
    field(:entries, non_null(list_of(non_null(:community_admin))))
    pagi_fields()
  end

  object :community_admin_directory_member do
    field(:member_id, non_null(:id))
    field(:is_lord, non_null(:boolean))
    field(:user, non_null(:common_user))
  end

  object :community_admin_directory_page do
    field(:entries, non_null(list_of(non_null(:community_admin_directory_member))))
    pagi_fields()
  end

  object :community_admin_request do
    @desc "ID of the membership request."
    field(:id, non_null(:id))
    @desc "Community where the grant would apply."
    field(:community_id, non_null(:id))
    field(:type, non_null(:string))
    @desc "Current stage of the request."
    field(:status, non_null(:string))
    @desc "Recorded acceptance or rejection."
    field(:decision, :string)
    @desc "Request revision used when deciding or cancelling."
    field(:revision, non_null(:integer))
    @desc "Actions requested for the prospective admin."
    field(:proposed_permissions, :json)
    @desc "Actions granted by the decision."
    field(:approved_permissions, :json)
    @desc "Deadline for deciding the request."
    field(:expires_at, :datetime)
    @desc "When the decision was recorded."
    field(:decided_at, :datetime)
    @desc "When the request was cancelled."
    field(:cancelled_at, :datetime)
    @desc "When expiration was recorded."
    field(:expired_at, :datetime)
    @desc "Account whose membership is at issue."
    field(:subject_user, :common_user)
    @desc "Account that opened the request."
    field(:created_by, :common_user)
  end

  object :community_admin_request_page do
    @desc "Admin invitations and applications returned for this page."
    field(:entries, non_null(list_of(non_null(:community_admin_request))))
    pagi_fields()
  end
end
