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

      middleware(M.ServerTrust)
      resolve(&R.Accounts.signin_oauth/3)
    end

    @desc "Refresh a persisted Browser Session for canonical Auth only."
    field :refresh_browser_session, :browser_signin_result do
      arg(:browser_session_ref, non_null(:string))

      middleware(M.ServerTrust)
      resolve(&R.Accounts.refresh_browser_session/3)
    end

    @desc "Revoke the current persisted Browser Session for canonical Auth only."
    field :revoke_browser_session, :done do
      arg(:browser_session_ref, non_null(:string))

      middleware(M.ServerTrust)
      resolve(&R.Accounts.revoke_browser_session/3)
    end

    field :revoke_browser_session_public, :done do
      arg(:browser_session_ref, non_null(:string))
      arg(:public_ref, non_null(:string))

      middleware(M.ServerTrust)
      resolve(&R.Accounts.revoke_browser_session_public/3)
    end

    field :revoke_other_browser_sessions, :done do
      arg(:browser_session_ref, non_null(:string))

      middleware(M.ServerTrust)
      resolve(&R.Accounts.revoke_other_browser_sessions/3)
    end

    @desc "Link an OAuth provider to the current account."
    field :link_oauth, :token_info do
      arg(:provider, non_null(:oauth_provider_input))

      middleware(M.ServerTrust)
      middleware(M.Authorize, :login)

      resolve(&R.Accounts.link_oauth/3)
    end

    @desc "Unlink an OAuth provider from the current account."
    field :unlink_oauth, :user do
      arg(:provider, non_null(:oauth_provider_input))

      middleware(M.ServerTrust)
      middleware(M.Authorize, :login)

      resolve(&R.Accounts.unlink_oauth/3)
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
