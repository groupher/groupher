defmodule GroupherServerWeb.Schema.Account.Queries do
  @moduledoc """
  GraphQL query fields for account profiles, Sessions, OAuth bindings, mailbox,
  follows, collections, permissions, and account search.

  Field middleware prepares identity, pagination, and public references before
  Accounts resolvers delegate reads to the domain context.

  Business position:

      Client
        -> Absinthe schema / Queries
        -> resolver or domain context
        -> GraphQL response
  """
  use Helper.GqlSchemaSuite
  import GroupherServerWeb.Schema.Helper.Queries

  object :account_queries do
    field :oauth_link_summary, :oauth_link_summary do
      arg(:ref, non_null(:string))
      arg(:browser_session_ref, non_null(:string))
      middleware(M.DelegatedScope, audience: "phoenix:auth-api", scope: "auth:oauth:flow")
      resolve(&R.Accounts.Sessions.oauth_link_summary/3)
    end

    @desc "Available public OAuth providers and their admission states."
    field :oauth_providers, non_null(list_of(non_null(:oauth_provider_status))) do
      resolve(&R.Accounts.Sessions.oauth_providers/3)
    end

    @desc "Read a pending OAuth registration summary through Auth."
    field :oauth_registration_summary, :oauth_registration_summary do
      arg(:flow_ref, non_null(:string))
      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:oauth:flow")
      resolve(&R.Accounts.Sessions.oauth_registration_summary/3)
    end

    @desc "List browser sessions for the account identified by the current session reference. Auth service only."
    field :browser_sessions, non_null(:browser_session_page) do
      arg(:browser_session_ref, non_null(:string))
      arg(:pagi, :pagi_input)

      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:session:read")
      resolve(&R.Accounts.Sessions.browser_sessions/3)
    end

    @desc "List OAuth identities linked to the user represented by the delegated Auth request."
    field :linked_oauth_accounts, non_null(:linked_oauth_accounts) do
      middleware(M.DelegatedScope, audience: "phoenix:auth-api", scope: "auth:oauth:read")
      resolve(&R.Accounts.Sessions.linked_oauth_accounts/3)
    end

    @desc "List user profiles one page at a time."
    field :paged_users, non_null(:user_page) do
      arg(:filter, :user_list_filter)
      arg(:pagi, :pagi_input)

      resolve(&R.Accounts.Profiles.paged_users/3)
    end

    @desc "Return the signed-in user's profile, or null for an anonymous request."
    field :me, :user do
      resolve(&R.Accounts.Profiles.me/3)
    end

    @desc "Return the signed-in user's global Passport permissions."
    field :current_global_passport, non_null(:global_passport) do
      middleware(M.Authorize, :login)
      resolve(&R.CMS.Passport.current_global/3)
    end

    @desc "Look up a user's profile by login."
    field :user, :user do
      arg(:login, non_null(:string))
      middleware(M.FrontDesk, :user)

      resolve(&R.Accounts.Profiles.user/3)
    end

    @desc "Return the request's authentication state and the signed-in user, if any."
    field :session_state, :session_state do
      resolve(&R.Accounts.Sessions.session_state/3)
    end

    @desc "List communities the specified user subscribes to."
    field :subscribed_communities, :community_page do
      arg(:login, non_null(:string))
      arg(:filter, :user_list_filter)
      arg(:pagi, :pagi_input)

      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.Profiles.subscribed_communities/3)
    end

    @desc "Suggest a limited set of communities for discovery, including Home when visible."
    field :default_community_suggestions, non_null(list_of(non_null(:community))) do
      resolve(&R.Accounts.Profiles.default_community_suggestions/3)
    end

    @desc "List the viewer's mailbox mentions by read state; defaults to unread."
    field :paged_mentions, :paged_mailbox_mentions do
      arg(:pagi, :pagi_input)
      arg(:filter, :mailbox_mentions_filter)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.Mailbox.paged_mailbox_mentions/3)
    end

    @desc "List the viewer's mailbox notifications by read state; defaults to unread."
    field :paged_notifications, :paged_mailbox_notifications do
      arg(:pagi, :pagi_input)
      arg(:filter, :mailbox_notifications_filter)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.Mailbox.paged_mailbox_notifications/3)
    end

    @desc "List accounts that follow the specified user."
    field :paged_followers, :user_page do
      arg(:login, non_null(:string))
      arg(:filter, :user_list_filter)
      arg(:pagi, :pagi_input)

      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.Relationships.paged_followers/3)
    end

    @desc "List accounts the specified user follows."
    field :paged_followings, :user_page do
      arg(:login, non_null(:string))
      arg(:filter, :user_list_filter)
      arg(:pagi, :pagi_input)

      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.Relationships.paged_followings/3)
    end

    @desc "List articles upvoted by the specified user."
    field :paged_upvoted_articles, :article_collection_page do
      arg(:login, non_null(:string))
      arg(:pagi, :pagi_input)
      arg(:filter, :article_collection_filter)

      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.Relationships.paged_upvoted_articles/3)
    end

    @desc "List the specified user's collection folders visible to the viewer."
    field :paged_collect_folders, :collect_folder_page do
      arg(:login, non_null(:string))
      arg(:pagi, :pagi_input)
      arg(:filter, :article_collection_filter)

      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.Relationships.paged_collect_folders/3)
    end

    @desc "List articles in the specified collection folder."
    field :paged_collected_articles, :article_collection_page do
      arg(:folder_id, non_null(:id))
      arg(:pagi, :pagi_input)
      arg(:filter, :article_collection_filter)

      resolve(&R.Accounts.Relationships.paged_collected_articles/3)
    end

    @desc "paged communities which the user it's the editor"
    field :administered_communities, :community_page do
      arg(:login, :string)
      arg(:pagi, :pagi_input)

      middleware(M.FrontDesk, {:user, optional: true})
      resolve(&R.Accounts.Profiles.administered_communities/3)
    end

    @desc "Find up to 15 users whose login or nickname matches the search text."
    field :search_users, non_null(list_of(non_null(:common_user))) do
      arg(:name, non_null(:string))

      resolve(&R.Accounts.Profiles.search_users/3)
    end

    @desc "List comments published by the specified user, optionally restricted to a thread."
    field :paged_published_comments, :comment_collection_page do
      arg(:login, non_null(:string))
      arg(:filter, :comment_page_filter)
      arg(:pagi, :pagi_input)
      arg(:thread, :thread)

      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.Profiles.paged_published_comments/3)
    end

    published_article_queries()
  end
end
