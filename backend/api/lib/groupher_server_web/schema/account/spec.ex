defmodule GroupherServerWeb.Schema.Account.Spec do
  @moduledoc """
  Shared GraphQL object, input, filter, and enum types for the Accounts API.

  These types project Accounts schemas into the stable browser/internal-service
  contract and attach field-level resolvers for associations and viewer state.

  Business position:

      Client
        -> Absinthe schema / Types
        -> resolver or domain context
        -> GraphQL response
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Fields
  import Absinthe.Resolution.Helpers

  alias GroupherServer.Accounts
  alias GroupherServerWeb.Schema

  import_types(Schema.Account.Metrics)

  object :session_state do
    @desc "Account authenticated for this request, if any."
    field(:user, :user)

    @desc "Whether the request has an authenticated user."
    field(:is_valid, :boolean)

    @desc "Subject identifying the signed-in user for delegated requests."
    field(:delegation_subject, :string)
  end

  object :linked_oauth_account do
    @desc "Public reference used to unlink this OAuth binding."
    field(:public_ref, non_null(:id))

    @desc "OAuth provider for this binding."
    field(:provider, non_null(:string))

    @desc "Username on the linked provider account."
    field(:login, :string)

    @desc "Display name from the linked provider account."
    field(:nickname, :string)

    @desc "Avatar URL from the linked provider account."
    field(:avatar, :string)

    @desc "Whether another OAuth binding would remain after removing this one."
    field(:can_unlink, non_null(:boolean))

    @desc "When the provider account was linked."
    field(:linked_at, non_null(:datetime))
  end

  object :linked_oauth_accounts do
    @desc "Provider accounts linked to the user, oldest binding first."
    field(:entries, non_null(list_of(non_null(:linked_oauth_account))))
  end

  object :profile_view_track_result do
    @desc "Whether this visit counted as a profile view."
    field(:tracked, non_null(:boolean))

    @desc "Profile view count after evaluating this visit."
    field(:views, non_null(:integer))
  end

  object :user_meta do
    @desc "Whether the account is marked as a maker."
    field(:is_maker, :boolean)

    @desc "Number of posts published by the user."
    field(:published_posts_count, :integer)

    @desc "Number of blog articles published by the user."
    field(:published_blogs_count, :integer)

    @desc "Number of active reports filed by the user, or zero without a resolvable account ID."
    field(:reported_count, :integer, resolve: &R.AlertWall.reported_count/3)
  end

  object :user do
    meta(:cache, max_age: 30)

    @desc "Account handle used to look up this profile."
    field(:login, non_null(:string))

    @desc "Account flags and publication and reporting counts."
    field(:meta, :user_meta,
      resolve: fn %{id: user_id, meta: meta}, _, _ ->
        {:ok, Map.put(meta || %{}, :user_id, user_id)}
      end
    )

    @desc "Display name on the profile."
    field(:nickname, :string)

    @desc "Profile avatar URL."
    field(:avatar, :string)

    @desc "Full profile biography."
    field(:bio, :string)

    @desc "Short profile introduction."
    field(:shortbio, :string)

    @desc "Sex listed on the profile."
    field(:sex, :string)

    @desc "Email address on the profile."
    field(:email, :string)

    @desc "Location listed on the profile."
    field(:location, :string)

    @desc "City recorded for the account."
    field(:geo_city, :string)

    @desc "Number of counted visits to this profile."
    field(:views, :integer)

    @desc "Social accounts and links listed on the profile."
    field(:social, :social_map, resolve: dataloader(Accounts, :social))

    # field(:achievement, :achievement, resolve: dataloader(Accounts, :achievement))

    @desc "Reputation, article engagement totals, and source contributions."
    field(:achievement, :achievement) do
      resolve(dataloader(Accounts, :achievement))
      middleware(M.AchievementProof)
    end

    field(:subscribed_communities_count, :integer)

    @desc "Number of accounts following this user."
    field(:followers_count, :integer)

    @desc "Number of accounts this user follows."
    field(:followings_count, :integer)

    @desc "Whether the viewer follows this user."
    field(:viewer_has_followed, :boolean)

    @desc "Whether this user follows the viewer."
    field(:viewer_been_followed, :boolean)

    @desc "Contribution totals and activity records for the reporting period."
    field(:contributes, :contribute_map)

    # 2. has_system_messages ?
    # 3. has_notifications ?
    # 4. has_watches ?

    @desc "Unread mailbox counts for the signed-in viewer, regardless of whose profile is queried."
    field :mailbox, :mailbox_status do
      middleware(M.Authorize, :login)
      resolve(&R.Accounts.Mailbox.mailbox_status/3)
    end

    timestamp_fields()
  end

  object :mailbox_status do
    @desc "Whether the viewer has no unread mentions or notifications."
    field(:is_empty, :boolean)

    @desc "Total unread mentions and notifications."
    field(:unread_total_count, :integer)

    @desc "Number of unread mentions."
    field(:unread_mentions_count, :integer)

    @desc "Number of unread notifications."
    field(:unread_notifications_count, :integer)
  end

  object :mailbox_mention do
    @desc "Identifier of the mention in the mailbox."
    field(:id, :id)

    @desc "Content thread associated with the mention."
    field(:thread, :thread)

    @desc "Identifier of the article associated with the mention."
    field(:article_id, :id)

    @desc "Title recorded with the mention."
    field(:title, :string)

    @desc "Identifier of the comment, for mentions made in a comment."
    field(:comment_id, :id)

    @desc "Whether the recipient has read the mention."
    field(:read, :boolean)

    @desc "Identifiers of content blocks containing the mention."
    field(:block_linker, list_of(:string))

    @desc "User who made the mention."
    field(:user, :common_user)

    timestamp_fields()
  end

  object :mailbox_notification do
    @desc "Identifier of the notification in the mailbox."
    field(:id, :id)

    @desc "Action that triggered the notification."
    field(:action, :string)

    @desc "Content thread associated with the notification, if any."
    field(:thread, :thread)

    @desc "Identifier of the related article, if any."
    field(:article_id, :id)

    @desc "Title recorded for the notification."
    field(:title, :string)

    @desc "Identifier of the related comment, if any."
    field(:comment_id, :id)

    @desc "Whether the recipient has read the notification."
    field(:read, :boolean)

    @desc "Users recorded as actors for this notification."
    field(:from_users, list_of(:common_user))

    @desc "Number of actors recorded for this notification."
    field(:from_users_count, :integer)

    timestamp_fields()
  end

  object :github_profile do
    @desc "Local identifier of the GitHub profile record."
    field(:id, :id)

    @desc "Account identifier assigned by GitHub."
    field(:github_id, :string)
    # field(:user, :user, resolve: dataloader(Accounts, :user))
    @desc "GitHub username."
    field(:login, :string)

    @desc "URL of the GitHub avatar."
    field(:avatar_url, :string)

    @desc "GitHub API URL for the account."
    field(:url, :string)

    @desc "Public GitHub profile URL."
    field(:html_url, :string)

    @desc "Display name on the GitHub profile."
    field(:name, :string)

    @desc "Company listed on GitHub."
    field(:company, :string)

    @desc "Website listed on GitHub."
    field(:blog, :string)

    @desc "Location listed on GitHub."
    field(:location, :string)

    @desc "Email address listed on GitHub."
    field(:email, :string)

    @desc "Biography listed on GitHub."
    field(:bio, :string)

    @desc "Number of public GitHub repositories."
    field(:public_repos, :integer)

    @desc "Number of public GitHub gists."
    field(:public_gists, :integer)
  end

  object :education_background do
    @desc "School attended by the user."
    field(:school, :string)

    @desc "Field of study at the school."
    field(:major, :string)
  end

  object :work_background do
    @desc "Employer listed in the user's work history."
    field(:company, :string)

    @desc "Job title at the company."
    field(:title, :string)
  end

  object :social_map do
    social_fields()
  end

  object :collect_folder_meta do
    collect_folder_meta_fields()
  end

  object :collect_folder do
    @desc "Identifier of the collection folder."
    field(:id, :id)

    @desc "Folder title."
    field(:title, :string)

    @desc "Description of the folder's contents."
    field(:desc, :string)

    @desc "Position assigned to the folder."
    field(:index, :integer)

    @desc "Total number of collected entries in the folder."
    field(:total_count, :integer)

    @desc "Whether the folder is private."
    field(:private, :boolean)

    @desc "When the folder's collected items last changed."
    field(:last_updated, :datetime)

    @desc "Presence and count of collected items by thread."
    field(:meta, :collect_folder_meta)

    timestamp_fields()
  end

  object :collect_folder_page do
    @desc "Collection folders on this page."
    field(:entries, list_of(:collect_folder))
    pagi_fields()
  end

  object :source_contribute do
    @desc "Whether the user has contributed to the web project."
    field(:web, :boolean)

    @desc "Whether the user has contributed to the server project."
    field(:server, :boolean)

    @desc "Whether the user has contributed to the mini program."
    field(:we_app, :boolean)

    @desc "Whether the user has contributed to the H5 project."
    field(:h5, :boolean)

    @desc "Whether the user has contributed to the mobile project."
    field(:mobile, :boolean)
  end

  object :achievement do
    @desc "Reputation score for the account."
    field(:reputation, :integer)
    # field(:followers_count, :integer)
    @desc "Upvotes received on the user's articles."
    field(:articles_upvotes_count, :integer)

    @desc "Times the user's articles have been collected."
    field(:articles_collects_count, :integer)
    # field(:contents_watched_count, :integer)

    @desc "Parts of the project to which the user has contributed."
    field(:source_contribute, :source_contribute)
  end

  object :browser_signin_result do
    @desc "Access token issued for the browser session."
    field(:access_token, :string)

    @desc "When the access token expires."
    field(:access_expires_at, :datetime)

    @desc "Session reference used by the Auth service to refresh or revoke the session."
    field(:browser_session_ref, :string)

    @desc "Absolute expiry of the session, independent of access token refreshes."
    field(:session_absolute_expires_at, :datetime)
  end

  object :browser_session_page do
    @desc "Browser sessions on this page."
    field(:entries, non_null(list_of(non_null(:browser_session))))
    pagi_fields()
  end

  object :browser_session do
    @desc "Public identifier used to select this session for revocation."
    field(:public_ref, :string)

    @desc "Whether this is the session used to request the list."
    field(:is_current, :boolean)

    @desc "Reported state of the browser session."
    field(:status, :string)

    @desc "Browser family recorded for the session."
    field(:browser_family, :string)

    @desc "Operating system family recorded for the session."
    field(:os_family, :string)

    @desc "Device family recorded for the session."
    field(:device_family, :string)

    @desc "Summary of the session's user agent."
    field(:user_agent_summary, :string)

    @desc "Country recorded at session creation."
    field(:created_country, :string)

    @desc "Region recorded at session creation."
    field(:created_region, :string)

    @desc "City recorded at session creation."
    field(:created_city, :string)

    @desc "Country most recently recorded for the session."
    field(:last_seen_country, :string)

    @desc "Region most recently recorded for the session."
    field(:last_seen_region, :string)

    @desc "City most recently recorded for the session."
    field(:last_seen_city, :string)

    @desc "When the session was created."
    field(:inserted_at, :datetime)

    @desc "When the session was last seen."
    field(:last_seen_at, :datetime)
  end

  input_object :browser_session_metadata_input do
    @desc "Browser family reported at sign-in."
    field(:browser_family, :string)

    @desc "Operating system family reported at sign-in."
    field(:os_family, :string)

    @desc "Device family reported at sign-in."
    field(:device_family, :string)

    @desc "User agent summary supplied at sign-in."
    field(:user_agent_summary, :string)

    @desc "Country reported at sign-in."
    field(:created_country, :string)

    @desc "Region reported at sign-in."
    field(:created_region, :string)

    @desc "City reported at sign-in."
    field(:created_city, :string)
  end

  object :user_page do
    @desc "User accounts on this page."
    field(:entries, non_null(list_of(non_null(:user))))
    pagi_fields()
  end

  object :paged_mailbox_mentions do
    @desc "Mentions matching the requested read state on this page."
    field(:entries, list_of(:mailbox_mention))
    pagi_fields()
  end

  object :paged_mailbox_notifications do
    @desc "Notifications matching the requested read state on this page."
    field(:entries, list_of(:mailbox_notification))
    pagi_fields()
  end

  enum :mailbox_type do
    @desc "Direct mentions addressed to the viewer."
    value(:mention)

    @desc "Activity notifications addressed to the viewer."
    value(:notification)
  end
end
