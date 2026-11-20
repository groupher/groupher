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
    @desc "List Browser Sessions for canonical Auth through trusted transport only."
    field :browser_sessions, non_null(:browser_session_page) do
      arg(:browser_session_ref, non_null(:string))
      arg(:pagi, :pagi_input)

      middleware(M.ServiceScope, audience: "phoenix:auth-api", scope: "auth:session:read")
      resolve(&R.Accounts.Sessions.browser_sessions/3)
    end

    @desc "List linked OAuth accounts for canonical Auth."
    field :linked_oauth_accounts, non_null(:linked_oauth_accounts) do
      middleware(M.DelegatedScope, audience: "phoenix:auth-api", scope: "auth:oauth:read")
      resolve(&R.Accounts.Sessions.linked_oauth_accounts/3)
    end

    @desc "get all users"
    field :paged_users, non_null(:user_page) do
      arg(:filter, :user_list_filter)
      arg(:pagi, :pagi_input)

      resolve(&R.Accounts.Profiles.paged_users/3)
    end

    @desc "get cur user"
    field :me, :user do
      resolve(&R.Accounts.Profiles.me/3)
    end

    @desc "get user by login"
    field :user, :user do
      arg(:login, non_null(:string))
      middleware(M.FrontDesk, :user)

      resolve(&R.Accounts.Profiles.user/3)
    end

    @desc "check the cur token is valid or not"
    field :session_state, :session_state do
      resolve(&R.Accounts.Sessions.session_state/3)
    end

    @desc "anyone can get anyone's subscribed communities"
    field :subscribed_communities, :community_page do
      arg(:login, non_null(:string))
      arg(:filter, :user_list_filter)
      arg(:pagi, :pagi_input)

      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.Profiles.subscribed_communities/3)
    end

    @desc "Bounded discovery suggestions, independently including Home when visible."
    field :default_community_suggestions, non_null(list_of(non_null(:community))) do
      resolve(&R.Accounts.Profiles.default_community_suggestions/3)
    end

    @desc "get login user's mentions in mailbox"
    field :paged_mentions, :paged_mailbox_mentions do
      arg(:pagi, :pagi_input)
      arg(:filter, :mailbox_mentions_filter)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.Mailbox.paged_mailbox_mentions/3)
    end

    @desc "get login user's notifications in mailbox"
    field :paged_notifications, :paged_mailbox_notifications do
      arg(:pagi, :pagi_input)
      arg(:filter, :mailbox_notifications_filter)

      middleware(M.Authorize, :login)
      resolve(&R.Accounts.Mailbox.paged_mailbox_notifications/3)
    end

    @desc "get user's follower"
    field :paged_followers, :user_page do
      arg(:login, non_null(:string))
      arg(:filter, :user_list_filter)
      arg(:pagi, :pagi_input)

      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.Relationships.paged_followers/3)
    end

    @desc "get user's follower"
    field :paged_followings, :user_page do
      arg(:login, non_null(:string))
      arg(:filter, :user_list_filter)
      arg(:pagi, :pagi_input)

      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.Relationships.paged_followings/3)
    end

    @desc "get paged upvoted articles"
    field :paged_upvoted_articles, :article_collection_page do
      arg(:login, non_null(:string))
      arg(:pagi, :pagi_input)
      arg(:filter, :article_collection_filter)

      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.Relationships.paged_upvoted_articles/3)
    end

    @desc "get paged collect folders of a user"
    field :paged_collect_folders, :collect_folder_page do
      arg(:login, non_null(:string))
      arg(:pagi, :pagi_input)
      arg(:filter, :article_collection_filter)

      middleware(M.FrontDesk, :user)
      resolve(&R.Accounts.Relationships.paged_collect_folders/3)
    end

    @desc "get paged collected articles"
    field :paged_collected_articles, :article_collection_page do
      arg(:folder_id, non_null(:id))
      arg(:pagi, :pagi_input)
      arg(:filter, :article_collection_filter)

      resolve(&R.Accounts.Relationships.paged_collected_articles/3)
    end

    @desc "paged communities which the user it's the editor"
    field :moderatorable_communities, :community_page do
      arg(:login, :string)
      arg(:pagi, :pagi_input)

      middleware(M.FrontDesk, {:user, optional: true})
      resolve(&R.Accounts.Profiles.moderatorable_communities/3)
    end

    @desc "get all passport rules include system and community etc ..."
    field :all_passport_rules_string, :rules do
      middleware(M.Authorize, :login)

      resolve(&R.Accounts.Passport.get_all_rules/3)
    end

    @desc "search user by name"
    field :search_users, non_null(list_of(non_null(:common_user))) do
      arg(:name, non_null(:string))

      resolve(&R.Accounts.Profiles.search_users/3)
    end

    @desc "get paged published article comments"
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
