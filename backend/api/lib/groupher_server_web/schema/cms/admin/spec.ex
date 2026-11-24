defmodule GroupherServerWeb.Schema.CMS.Admin.Spec do
  @moduledoc """
  GraphQL types for Passport-backed Community Admin membership and requests.

      Community Admin rows / requests -> typed membership and request GraphQL values
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Fields

  object :community_admin do
    field(:member_id, non_null(:id))
    field(:revision, non_null(:integer))
    field(:is_lord, non_null(:boolean))
    field(:permissions, non_null(list_of(non_null(:passport_action))))
    field(:user, non_null(:common_user))
  end

  object :community_admin_page do
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
    field(:id, non_null(:id))
    field(:community_id, non_null(:id))
    field(:type, non_null(:string))
    field(:status, non_null(:string))
    field(:decision, :string)
    field(:revision, non_null(:integer))
    field(:proposed_permissions, :json)
    field(:approved_permissions, :json)
    field(:expires_at, :datetime)
    field(:decided_at, :datetime)
    field(:cancelled_at, :datetime)
    field(:expired_at, :datetime)
    field(:subject_user, :common_user)
    field(:created_by, :common_user)
  end

  object :community_admin_request_page do
    field(:entries, non_null(list_of(non_null(:community_admin_request))))
    pagi_fields()
  end
end
