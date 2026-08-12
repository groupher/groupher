defmodule GroupherServerWeb.Schema.Account.Mutations do
  @moduledoc """
  accounts mutations
  """
  use Helper.GqlSchemaSuite

  object :account_mutations do
    @desc "update user's profile"
    field :update_profile, :user do
      arg(:profile, non_null(:user_profile_input))
      arg(:social, :social_input)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.update_profile/3)
    end

    @desc "Sign in with an OAuth provider and return token info."
    field :signin_oauth, :browser_signin_result do
      arg(:provider, non_null(:oauth_provider_input))
      arg(:browser_session, :browser_session_metadata_input)

      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:session:signin")
      resolve(&R.Accounts.signin_oauth/3)
    end

    @desc "Refresh a persisted Browser Session for canonical Auth only."
    field :refresh_browser_session, :browser_signin_result do
      arg(:browser_session_ref, non_null(:string))

      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:session:refresh")
      resolve(&R.Accounts.refresh_browser_session/3)
    end

    @desc "Revoke the current persisted Browser Session for canonical Auth only."
    field :revoke_browser_session, :done do
      arg(:browser_session_ref, non_null(:string))

      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:session:revoke")
      resolve(&R.Accounts.revoke_browser_session/3)
    end

    field :revoke_browser_session_public, :done do
      arg(:browser_session_ref, non_null(:string))
      arg(:public_ref, non_null(:string))

      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:session:revoke")
      resolve(&R.Accounts.revoke_browser_session_public/3)
    end

    field :revoke_other_browser_sessions, :done do
      arg(:browser_session_ref, non_null(:string))

      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:session:revoke")
      resolve(&R.Accounts.revoke_other_browser_sessions/3)
    end

    @desc "Link a verified OAuth identity through canonical Auth."
    field :link_oauth_identity, non_null(:linked_oauth_accounts) do
      arg(:identity, non_null(:verified_oauth_identity_input))

      middleware(M.DelegatedScope,
        audience: "phoenix:auth-api",
        scope: "auth:oauth:link"
      )

      resolve(&R.Accounts.link_oauth_identity/3)
    end

    @desc "Unlink one OAuth binding through canonical Auth."
    field :unlink_oauth_identity, non_null(:linked_oauth_accounts) do
      arg(:public_ref, non_null(:id))

      middleware(M.DelegatedScope,
        audience: "phoenix:auth-api",
        scope: "auth:oauth:unlink"
      )

      resolve(&R.Accounts.unlink_oauth_identity/3)
    end

    @desc "follow a user"
    field :follow, :user do
      arg(:login, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.follow/3)
    end

    @desc "unfollow a user"
    field :undo_follow, :user do
      arg(:login, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.undo_follow/3)
    end

    @desc "create a collect folder"
    field :create_collect_folder, :collect_folder do
      arg(:title, non_null(:string))
      arg(:private, :boolean)
      arg(:desc, :string)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.create_collect_folder/3)
    end

    @desc "update a collect folder"
    field :update_collect_folder, :collect_folder do
      arg(:id, non_null(:id))
      arg(:title, :string)
      arg(:private, :boolean)
      arg(:desc, :string)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.update_collect_folder/3)
    end

    @desc "delete a collect folder"
    field :delete_collect_folder, :collect_folder do
      arg(:id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.delete_collect_folder/3)
    end

    @desc "add article into a collect folder"
    field :add_to_collect, :collect_folder do
      arg(:article, non_null(:article_path_input))
      arg(:folder_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :article)

      resolve(&R.Accounts.add_to_collect/3)
    end

    @desc "remove article from a collect folder"
    field :remove_from_collect, :collect_folder do
      arg(:article, non_null(:article_path_input))
      arg(:folder_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :article)

      resolve(&R.Accounts.remove_from_collect/3)
    end

    @desc "mark a message as read"
    field :mark_read, :done do
      arg(:ids, list_of(:id))
      arg(:type, :mailbox_type, default_value: :mention)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.mark_read/3)
    end

    @desc "mark all unread message as read"
    field :mark_read_all, :done do
      arg(:type, :mailbox_type, default_value: :mention)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.mark_read_all/3)
    end
  end
end
