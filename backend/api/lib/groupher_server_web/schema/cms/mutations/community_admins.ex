defmodule GroupherServerWeb.Schema.CMS.Mutations.CommunityAdmins do
  @moduledoc """
  GraphQL writes for Passport-backed Community Admin requests and memberships.

      GraphQL -> CommunityAdmins resolver -> Receipt-protected Admin commands
  """
  use Helper.GqlSchemaSuite

  object :cms_community_admin_mutations do
    @desc "Create an Admin invitation or submit the current user's application"
    field :create_community_admin_request, non_null(:community_admin_request) do
      arg(:community_ref, non_null(:string))
      arg(:type, non_null(:string))
      arg(:subject_login, :string)
      arg(:permissions, non_null(:json))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.CommunityAdmins.create/3)
    end

    @desc "Accept or reject an Admin invitation or application"
    field :decide_community_admin_request, non_null(:community_admin_request) do
      arg(:request_id, non_null(:id))
      arg(:revision, non_null(:integer))
      arg(:decision, non_null(:string))
      arg(:approved_permissions, :json)
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.CommunityAdmins.decide/3)
    end

    @desc "Cancel an Admin request at its current revision"
    field :cancel_community_admin_request, non_null(:community_admin_request) do
      arg(:request_id, non_null(:id))
      arg(:revision, non_null(:integer))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.CommunityAdmins.cancel/3)
    end

    @desc "Replace one Admin's grantable permissions at its current revision"
    field :update_community_admin_permissions, non_null(:community_admin) do
      arg(:community_ref, non_null(:string))
      arg(:member_id, non_null(:id))
      arg(:revision, non_null(:integer))
      arg(:permissions, non_null(:json))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.CommunityAdmins.update_permissions/3)
    end

    @desc "Remove one Admin membership at its current revision"
    field :remove_community_admin, non_null(:boolean) do
      arg(:community_ref, non_null(:string))
      arg(:member_id, non_null(:id))
      arg(:revision, non_null(:integer))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.CommunityAdmins.remove/3)
    end

    @desc "Leave the current user's ordinary Admin membership"
    field :leave_community_admins, non_null(:boolean) do
      arg(:community_ref, non_null(:string))
      arg(:revision, non_null(:integer))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.CommunityAdmins.leave/3)
    end
  end
end
