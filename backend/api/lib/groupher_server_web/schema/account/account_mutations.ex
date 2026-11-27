defmodule GroupherServerWeb.Schema.Account.Mutations do
  @moduledoc """
  GraphQL mutation fields for account profile, Session, OAuth binding, follow,
  collection, and mailbox writes.

  The schema declares input and middleware contracts only; Accounts resolvers
  and contexts own authorization-sensitive business behavior and persistence.

  Business position:

      Client
        -> Absinthe schema / Mutations
        -> resolver or domain context
        -> GraphQL response
  """
  use Helper.GqlSchemaSuite

  object :account_mutations do
    @desc "Exchange an acceptance credential for a browser session through the Auth service."
    field :redeem_production_seed_login, :browser_signin_result do
      arg(:credential, non_null(:string))
      arg(:browser_session, :browser_session_metadata_input)
      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:session:signin")
      resolve(&R.Accounts.Sessions.redeem_production_seed_login/3)
    end

    @desc "Evaluate a public profile visit and return whether it counted and the resulting view total."
    field :track_profile_view, non_null(:profile_view_track_result) do
      arg(:login, non_null(:string))

      middleware(M.ConditionalServiceScope,
        audience: "phoenix:view-api",
        scope: "view:track"
      )

      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.ProfileViewTracker.track_profile_view/3)
    end

    @desc "Update the signed-in user's profile and optional social details."
    field :update_profile, :user do
      arg(:profile, non_null(:user_profile_input))
      arg(:social, :social_input)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.Profiles.update_profile/3)
    end

    @desc "Sign in through the Auth service with an OAuth identity and return browser session credentials."
    field :signin_oauth, :oauth_signin_result do
      arg(:provider, non_null(:oauth_provider_input))
      arg(:browser_session, :browser_session_metadata_input)
      arg(:flow_ref, non_null(:string))
      arg(:return_to, :string)

      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:session:signin")
      resolve(&R.Accounts.Sessions.signin_oauth/3)
    end

    @desc "Complete an OAuth registration with a chosen login."
    field :complete_oauth_registration, :browser_signin_result do
      arg(:flow_ref, non_null(:string))
      arg(:login, non_null(:string))
      arg(:browser_session, :browser_session_metadata_input)

      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:oauth:register")
      resolve(&R.Accounts.Sessions.complete_oauth_registration/3)
    end

    @desc "Issue a fresh access token for an active browser session through the Auth service."
    field :refresh_browser_session, :browser_signin_result do
      arg(:browser_session_ref, non_null(:string))

      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:session:refresh")
      resolve(&R.Accounts.Sessions.refresh_browser_session/3)
    end

    @desc "Revoke the browser session identified by its Auth service session reference."
    field :revoke_browser_session, :done do
      arg(:browser_session_ref, non_null(:string))

      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:session:revoke")
      resolve(&R.Accounts.Sessions.revoke_browser_session/3)
    end

    @desc "Revoke another session on the same account by its public reference."
    field :revoke_browser_session_public, :done do
      arg(:browser_session_ref, non_null(:string))
      arg(:public_ref, non_null(:string))

      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:session:revoke")
      resolve(&R.Accounts.Sessions.revoke_browser_session_public/3)
    end

    @desc "Revoke the account's other browser sessions and keep the current session."
    field :revoke_other_browser_sessions, :done do
      arg(:browser_session_ref, non_null(:string))

      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:session:revoke")
      resolve(&R.Accounts.Sessions.revoke_other_browser_sessions/3)
    end

    field :oauth_link_start, :done do
      arg(:ref, non_null(:string))
      arg(:browser_session_ref, non_null(:string))
      arg(:provider, non_null(:string))
      arg(:code_verifier, non_null(:string))
      arg(:nonce, non_null(:string))
      arg(:return_to, non_null(:string))
      middleware(M.DelegatedScope, audience: "phoenix:auth-api", scope: "auth:oauth:flow")
      resolve(&R.Accounts.Sessions.oauth_link_start/3)
    end

    field :oauth_link_claim, :oauth_link_claim do
      arg(:ref, non_null(:string))
      arg(:browser_session_ref, non_null(:string))
      arg(:provider, non_null(:string))
      arg(:nonce, non_null(:string))
      middleware(M.DelegatedScope, audience: "phoenix:auth-api", scope: "auth:oauth:flow")
      resolve(&R.Accounts.Sessions.oauth_link_claim/3)
    end

    field :oauth_link_verified, :oauth_link_result do
      arg(:ref, non_null(:string))
      arg(:browser_session_ref, non_null(:string))
      arg(:identity, non_null(:verified_oauth_identity_input))
      middleware(M.DelegatedScope, audience: "phoenix:auth-api", scope: "auth:oauth:flow")
      resolve(&R.Accounts.Sessions.oauth_link_verified/3)
    end

    field :oauth_link_cancel, :done do
      arg(:ref, non_null(:string))
      arg(:browser_session_ref, non_null(:string))
      middleware(M.DelegatedScope, audience: "phoenix:auth-api", scope: "auth:oauth:flow")
      resolve(&R.Accounts.Sessions.oauth_link_cancel/3)
    end

    field :oauth_link_confirm, :oauth_link_result do
      arg(:ref, non_null(:string))
      arg(:browser_session_ref, non_null(:string))
      arg(:provider, non_null(:string))
      arg(:provider_id, non_null(:string))
      middleware(M.DelegatedScope, audience: "phoenix:auth-api", scope: "auth:oauth:flow")
      resolve(&R.Accounts.Sessions.oauth_link_confirm/3)
    end

    @desc "Remove the specified OAuth binding and return the remaining bindings."
    field :unlink_oauth_identity, non_null(:linked_oauth_accounts) do
      arg(:public_ref, non_null(:id))

      middleware(M.DelegatedScope,
        audience: "phoenix:auth-api",
        scope: "auth:oauth:unlink"
      )

      resolve(&R.Accounts.Sessions.unlink_oauth_identity/3)
    end

    @desc "Follow the user identified by login."
    field :follow, :user do
      arg(:login, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.Relationships.follow/3)
    end

    @desc "Stop following the user identified by login."
    field :undo_follow, :user do
      arg(:login, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.Relationships.undo_follow/3)
    end

    @desc "Create a collection folder for the signed-in user."
    field :create_collect_folder, :collect_folder do
      arg(:title, non_null(:string))
      arg(:private, :boolean)
      arg(:desc, :string)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.Relationships.create_collect_folder/3)
    end

    @desc "Change a collection folder's title, description, or privacy setting."
    field :update_collect_folder, :collect_folder do
      arg(:id, non_null(:id))
      arg(:title, :string)
      arg(:private, :boolean)
      arg(:desc, :string)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.Relationships.update_collect_folder/3)
    end

    @desc "Delete the collection folder identified by its ID."
    field :delete_collect_folder, :collect_folder do
      arg(:id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.Relationships.delete_collect_folder/3)
    end

    @desc "Add the specified article to a collection folder and return the collection result."
    field :add_to_collect, :article_collect_result do
      arg(:article, non_null(:article_path_input))
      arg(:folder_id, non_null(:id))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :article)

      resolve(&R.Accounts.Relationships.add_to_collect/3)
    end

    @desc "Remove the specified article from a collection folder and return the collection result."
    field :remove_from_collect, :article_collect_result do
      arg(:article, non_null(:article_path_input))
      arg(:folder_id, non_null(:id))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :article)

      resolve(&R.Accounts.Relationships.remove_from_collect/3)
    end

    @desc "Mark the selected mentions or notifications in the viewer's mailbox as read."
    field :mark_read, :done do
      arg(:ids, list_of(:id))
      arg(:type, :mailbox_type, default_value: :mention)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.Mailbox.mark_read/3)
    end

    @desc "Mark all messages of the selected type in the viewer's mailbox as read."
    field :mark_read_all, :done do
      arg(:type, :mailbox_type, default_value: :mention)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.Mailbox.mark_read_all/3)
    end
  end
end
