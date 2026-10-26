defmodule GroupherServer.Accounts do
  @moduledoc """
  Public boundary for the Accounts Context.

      transport / job / another Context
        -> Accounts
        -> internal Accounts capability or owner

  Callers outside `GroupherServer.Accounts.*` must enter through this module.
  """

  alias __MODULE__.Query

  @doc "Enriches a User collection with the viewer's follow state."
  defdelegate fans_mark_viewer_follow_status(result, viewer),
    to: GroupherServer.Accounts.Fans,
    as: :mark_viewer_follow_status

  @doc "Returns the Accounts Dataloader source used by the GraphQL adapter."
  @spec dataloader_source() :: Dataloader.Ecto.t()
  defdelegate dataloader_source(), to: Query

  @doc "Delegates GroupherServer.Accounts.Achievements.achieve/3 through the Accounts Context boundary."
  defdelegate achievements_achieve(arg1, arg2, arg3),
    to: GroupherServer.Accounts.Achievements,
    as: :achieve

  @doc "Delegates GroupherServer.Accounts.Achievements.paged_moderatorable_communities/2 through the Accounts Context boundary."
  defdelegate achievements_paged_moderatorable_communities(arg1, arg2),
    to: GroupherServer.Accounts.Achievements,
    as: :paged_moderatorable_communities

  @doc "Delegates GroupherServer.Accounts.CollectFolders.add_result/4 through the Accounts Context boundary."
  defdelegate collect_folders_add_result(arg1, arg2, arg3, arg4),
    to: GroupherServer.Accounts.CollectFolders,
    as: :add_result

  @doc "Delegates GroupherServer.Accounts.CollectFolders.create/2 through the Accounts Context boundary."
  defdelegate collect_folders_create(arg1, arg2),
    to: GroupherServer.Accounts.CollectFolders,
    as: :create

  @doc "Delegates GroupherServer.Accounts.CollectFolders.delete/1 through the Accounts Context boundary."
  defdelegate collect_folders_delete(arg1),
    to: GroupherServer.Accounts.CollectFolders,
    as: :delete

  @doc "Delegates GroupherServer.Accounts.CollectFolders.paged_articles/3 through the Accounts Context boundary."
  defdelegate collect_folders_paged_articles(arg1, arg2, arg3),
    to: GroupherServer.Accounts.CollectFolders,
    as: :paged_articles

  @doc "Delegates GroupherServer.Accounts.CollectFolders.paged_articles/4 through the Accounts Context boundary."
  defdelegate collect_folders_paged_articles(arg1, arg2, arg3, arg4),
    to: GroupherServer.Accounts.CollectFolders,
    as: :paged_articles

  @doc "Delegates GroupherServer.Accounts.CollectFolders.paged/3 through the Accounts Context boundary."
  defdelegate collect_folders_paged(arg1, arg2, arg3),
    to: GroupherServer.Accounts.CollectFolders,
    as: :paged

  @doc "Delegates GroupherServer.Accounts.CollectFolders.paged/4 through the Accounts Context boundary."
  defdelegate collect_folders_paged(arg1, arg2, arg3, arg4),
    to: GroupherServer.Accounts.CollectFolders,
    as: :paged

  @doc "Delegates GroupherServer.Accounts.CollectFolders.remove_result/4 through the Accounts Context boundary."
  defdelegate collect_folders_remove_result(arg1, arg2, arg3, arg4),
    to: GroupherServer.Accounts.CollectFolders,
    as: :remove_result

  @doc "Delegates GroupherServer.Accounts.CollectFolders.update/2 through the Accounts Context boundary."
  defdelegate collect_folders_update(arg1, arg2),
    to: GroupherServer.Accounts.CollectFolders,
    as: :update

  @doc "Delegates GroupherServer.Accounts.Fans.follow/2 through the Accounts Context boundary."
  defdelegate fans_follow(arg1, arg2), to: GroupherServer.Accounts.Fans, as: :follow

  @doc "Delivers one typed Fans effect from a background worker."
  defdelegate fans_deliver_event(type, user_id, from_user_id),
    to: GroupherServer.Accounts.Fans.Effects,
    as: :deliver_event

  @doc "Delegates GroupherServer.Accounts.Fans.paged_followers/3 through the Accounts Context boundary."
  defdelegate fans_paged_followers(arg1, arg2, arg3),
    to: GroupherServer.Accounts.Fans,
    as: :paged_followers

  @doc "Delegates GroupherServer.Accounts.Fans.paged_followers/4 through the Accounts Context boundary."
  defdelegate fans_paged_followers(arg1, arg2, arg3, arg4),
    to: GroupherServer.Accounts.Fans,
    as: :paged_followers

  @doc "Delegates GroupherServer.Accounts.Fans.paged_followings/3 through the Accounts Context boundary."
  defdelegate fans_paged_followings(arg1, arg2, arg3),
    to: GroupherServer.Accounts.Fans,
    as: :paged_followings

  @doc "Delegates GroupherServer.Accounts.Fans.paged_followings/4 through the Accounts Context boundary."
  defdelegate fans_paged_followings(arg1, arg2, arg3, arg4),
    to: GroupherServer.Accounts.Fans,
    as: :paged_followings

  @doc "Delegates GroupherServer.Accounts.Fans.undo_follow/2 through the Accounts Context boundary."
  defdelegate fans_undo_follow(arg1, arg2), to: GroupherServer.Accounts.Fans, as: :undo_follow

  @doc "Delegates GroupherServer.Accounts.FrontDesk.fresh_user/1 through the Accounts Context boundary."
  defdelegate front_desk_fresh_user(arg1), to: GroupherServer.Accounts.FrontDesk, as: :fresh_user

  @doc "Delegates GroupherServer.Accounts.FrontDesk.user/1 through the Accounts Context boundary."
  defdelegate front_desk_user(arg1), to: GroupherServer.Accounts.FrontDesk, as: :user

  @doc """
  Delegates an explicitly configured User read through the Accounts Context boundary.

  ## Examples

      Accounts.front_desk_user("alice", mode: :internal, view: :default)
  """
  defdelegate front_desk_user(ref, opts), to: GroupherServer.Accounts.FrontDesk, as: :user

  @doc "Reloads one User and refreshes its cache through the Accounts FrontDesk seam."
  @spec front_desk_revalidate_user(String.t() | integer()) ::
          {:ok, struct()} | {:error, term()}
  defdelegate front_desk_revalidate_user(ref),
    to: GroupherServer.Accounts.FrontDesk.Revalidate,
    as: :user

  @doc "Reloads several Users and refreshes their cache through the Accounts FrontDesk seam."
  @spec front_desk_revalidate_users([String.t() | integer()]) ::
          {:ok, [struct()]} | {:error, term()}
  defdelegate front_desk_revalidate_users(refs),
    to: GroupherServer.Accounts.FrontDesk.Revalidate,
    as: :users

  @doc "Delegates GroupherServer.Accounts.Mailbox.invalidate_users/1 through the Accounts Context boundary."
  defdelegate mailbox_invalidate_users(arg1),
    to: GroupherServer.Accounts.Mailbox,
    as: :invalidate_users

  @doc "Delegates GroupherServer.Accounts.Mailbox.mark_read_all/2 through the Accounts Context boundary."
  defdelegate mailbox_mark_read_all(arg1, arg2),
    to: GroupherServer.Accounts.Mailbox,
    as: :mark_read_all

  @doc "Delegates GroupherServer.Accounts.Mailbox.mark_read/3 through the Accounts Context boundary."
  defdelegate mailbox_mark_read(arg1, arg2, arg3),
    to: GroupherServer.Accounts.Mailbox,
    as: :mark_read

  @doc "Delegates GroupherServer.Accounts.Mailbox.paged_messages/4 through the Accounts Context boundary."
  defdelegate mailbox_paged_messages(arg1, arg2, arg3, arg4),
    to: GroupherServer.Accounts.Mailbox,
    as: :paged_messages

  @doc "Delegates GroupherServer.Accounts.Mailbox.status/1 through the Accounts Context boundary."
  defdelegate mailbox_status(arg1), to: GroupherServer.Accounts.Mailbox, as: :status

  @doc "Delegates GroupherServer.Accounts.Mailbox.update_status_many_in_transaction/1 through the Accounts Context boundary."
  defdelegate mailbox_update_status_many_in_transaction(arg1),
    to: GroupherServer.Accounts.Mailbox,
    as: :update_status_many_in_transaction

  @doc "Delegates GroupherServer.Accounts.Model.Embeds.UserMeta.default_meta/0 through the Accounts Context boundary."
  defdelegate model_embeds_user_meta_default_meta(),
    to: GroupherServer.Accounts.Model.Embeds.UserMeta,
    as: :default_meta

  @doc "Delegates GroupherServer.Accounts.Profiles.browser_sessions_for_ref/1 through the Accounts Context boundary."
  defdelegate profiles_browser_sessions_for_ref(arg1, pagi),
    to: GroupherServer.Accounts.Profiles,
    as: :browser_sessions_for_ref

  @doc "Delegates GroupherServer.Accounts.Profiles.default_community_suggestions/0 through the Accounts Context boundary."
  defdelegate profiles_default_community_suggestions(),
    to: GroupherServer.Accounts.Profiles,
    as: :default_community_suggestions

  @doc "Delegates GroupherServer.Accounts.Profiles.link_oauth_identity/2 through the Accounts Context boundary."
  defdelegate profiles_link_oauth_identity(arg1, arg2),
    to: GroupherServer.Accounts.Profiles,
    as: :link_oauth_identity

  @doc "Delegates GroupherServer.Accounts.Profiles.linked_oauth_accounts/1 through the Accounts Context boundary."
  defdelegate profiles_linked_oauth_accounts(arg1),
    to: GroupherServer.Accounts.Profiles,
    as: :linked_oauth_accounts

  @doc "Delegates GroupherServer.Accounts.Profiles.paged_users/2 through the Accounts Context boundary."
  defdelegate profiles_paged_users(arg1, arg2),
    to: GroupherServer.Accounts.Profiles,
    as: :paged_users

  @doc "Delegates GroupherServer.Accounts.Profiles.paged_users/3 through the Accounts Context boundary."
  defdelegate profiles_paged_users(arg1, arg2, arg3),
    to: GroupherServer.Accounts.Profiles,
    as: :paged_users

  @doc "Delegates GroupherServer.Accounts.Profiles.user/1 through the Accounts Context boundary."
  defdelegate profiles_user(arg1), to: GroupherServer.Accounts.Profiles, as: :user

  @doc "Delegates GroupherServer.Accounts.Profiles.user/2 through the Accounts Context boundary."
  defdelegate profiles_user(arg1, arg2), to: GroupherServer.Accounts.Profiles, as: :user

  @doc "Delegates contribution projection refresh through the Accounts Context boundary."
  defdelegate profiles_refresh_contributions(user_id, digest),
    to: GroupherServer.Accounts.Profiles,
    as: :refresh_contributions

  @doc "Delegates explicit Profile view tracking through the Accounts Context boundary."
  defdelegate profile_view_tracker_track(profile, viewer, classification, opts),
    to: GroupherServer.Accounts.ProfileViewTracker,
    as: :track

  @doc "Delegates Profile view dedupe cleanup through the Accounts Context boundary."
  defdelegate profile_view_tracker_cleanup_expired(),
    to: GroupherServer.Accounts.ProfileViewTracker,
    as: :cleanup_expired

  @doc "Delegates GroupherServer.Accounts.Profiles.refresh_browser_session/1 through the Accounts Context boundary."
  defdelegate profiles_refresh_browser_session(arg1),
    to: GroupherServer.Accounts.Profiles,
    as: :refresh_browser_session

  @doc "Delegates GroupherServer.Accounts.Profiles.revoke_browser_session_public/2 through the Accounts Context boundary."
  defdelegate profiles_revoke_browser_session_public(arg1, arg2),
    to: GroupherServer.Accounts.Profiles,
    as: :revoke_browser_session_public

  @doc "Delegates GroupherServer.Accounts.Profiles.revoke_browser_session/1 through the Accounts Context boundary."
  defdelegate profiles_revoke_browser_session(arg1),
    to: GroupherServer.Accounts.Profiles,
    as: :revoke_browser_session

  @doc "Delegates GroupherServer.Accounts.Profiles.revoke_other_browser_sessions_for_ref/1 through the Accounts Context boundary."
  defdelegate profiles_revoke_other_browser_sessions_for_ref(arg1),
    to: GroupherServer.Accounts.Profiles,
    as: :revoke_other_browser_sessions_for_ref

  @doc "Delegates GroupherServer.Accounts.Profiles.session_state/1 through the Accounts Context boundary."
  defdelegate profiles_session_state(arg1),
    to: GroupherServer.Accounts.Profiles,
    as: :session_state

  @doc "Delegates GroupherServer.Accounts.Profiles.signin_oauth/1 through the Accounts Context boundary."
  defdelegate profiles_signin_oauth(arg1), to: GroupherServer.Accounts.Profiles, as: :signin_oauth

  @doc "Delegates GroupherServer.Accounts.Profiles.signin_oauth/2 through the Accounts Context boundary."
  defdelegate profiles_signin_oauth(arg1, arg2),
    to: GroupherServer.Accounts.Profiles,
    as: :signin_oauth

  @doc "Delegates GroupherServer.Accounts.Profiles.subscribed_communities/3 through the Accounts Context boundary."
  defdelegate profiles_subscribed_communities(arg1, arg2, arg3),
    to: GroupherServer.Accounts.Profiles,
    as: :subscribed_communities

  @doc "Delegates GroupherServer.Accounts.Profiles.unlink_oauth_identity/2 through the Accounts Context boundary."
  defdelegate profiles_unlink_oauth_identity(arg1, arg2),
    to: GroupherServer.Accounts.Profiles,
    as: :unlink_oauth_identity

  @doc "Delegates GroupherServer.Accounts.Profiles.update_profile/2 through the Accounts Context boundary."
  defdelegate profiles_update_profile(arg1, arg2),
    to: GroupherServer.Accounts.Profiles,
    as: :update_profile

  @doc "Delegates GroupherServer.Accounts.Profiles.update_subscribe_state/1 through the Accounts Context boundary."
  defdelegate profiles_update_subscribe_state(arg1),
    to: GroupherServer.Accounts.Profiles,
    as: :update_subscribe_state

  @doc "Delegates GroupherServer.Accounts.Publish.paged_articles/4 through the Accounts Context boundary."
  defdelegate publish_paged_articles(arg1, arg2, arg3, arg4),
    to: GroupherServer.Accounts.Publish,
    as: :paged_articles

  @doc "Delegates GroupherServer.Accounts.Publish.paged_articles/5 through the Accounts Context boundary."
  defdelegate publish_paged_articles(arg1, arg2, arg3, arg4, arg5),
    to: GroupherServer.Accounts.Publish,
    as: :paged_articles

  @doc "Pages published Comments through the Accounts Context boundary."
  defdelegate publish_paged_comments(user, thread, filter, pagi, viewer),
    to: GroupherServer.Accounts.Publish,
    as: :paged_comments

  @doc "Delegates GroupherServer.Accounts.Publish.update_states/2 through the Accounts Context boundary."
  defdelegate publish_update_states(arg1, arg2),
    to: GroupherServer.Accounts.Publish,
    as: :update_states

  @doc "Revalidates a user after its published-count projection commits."
  defdelegate publish_revalidate_user(arg1),
    to: GroupherServer.Accounts.Publish,
    as: :revalidate_user

  @doc "Delegates GroupherServer.Accounts.Search.user/1 through the Accounts Context boundary."
  defdelegate search_user(arg1), to: GroupherServer.Accounts.Search, as: :user

  @doc "Delegates GroupherServer.Accounts.Upvotes.paged_articles/3 through the Accounts Context boundary."
  defdelegate upvotes_paged_articles(arg1, arg2, arg3),
    to: GroupherServer.Accounts.Upvotes,
    as: :paged_articles

  @doc "Delegates Accounts.Profiles.ErrorCat.account_login/0 through the Accounts Context boundary."
  defdelegate profiles_error_cat_account_login(),
    to: GroupherServer.Accounts.Profiles.ErrorCat,
    as: :account_login

  @doc "Delegates Accounts.Profiles.ErrorCat.account_login/1 through the Accounts Context boundary."
  defdelegate profiles_error_cat_account_login(arg1),
    to: GroupherServer.Accounts.Profiles.ErrorCat,
    as: :account_login

  @doc "Delegates Accounts.Profiles.BrowserSessions.active_for_user?/2 through the Accounts Context boundary."
  defdelegate profiles_browser_sessions_active_for_user?(arg1, arg2),
    to: GroupherServer.Accounts.Profiles.BrowserSessions,
    as: :active_for_user?

  @doc "Delegates Accounts.Profiles.ErrorCat.session_revoked/0 through the Accounts Context boundary."
  defdelegate profiles_error_cat_session_revoked(),
    to: GroupherServer.Accounts.Profiles.ErrorCat,
    as: :session_revoked

  @doc "Delegates Accounts.Profiles.ErrorCat.session_revoked/1 through the Accounts Context boundary."
  defdelegate profiles_error_cat_session_revoked(arg1),
    to: GroupherServer.Accounts.Profiles.ErrorCat,
    as: :session_revoked

  @doc "Delegates Accounts.Profiles.ErrorCat.current_session/0 through the Accounts Context boundary."
  defdelegate profiles_error_cat_current_session(),
    to: GroupherServer.Accounts.Profiles.ErrorCat,
    as: :current_session

  @doc "Delegates Accounts.Profiles.ErrorCat.current_session/1 through the Accounts Context boundary."
  defdelegate profiles_error_cat_current_session(arg1),
    to: GroupherServer.Accounts.Profiles.ErrorCat,
    as: :current_session

  @doc "Delegates Accounts.Profiles.ErrorCat.session_expired/0 through the Accounts Context boundary."
  defdelegate profiles_error_cat_session_expired(),
    to: GroupherServer.Accounts.Profiles.ErrorCat,
    as: :session_expired

  @doc "Delegates Accounts.Profiles.ErrorCat.session_expired/1 through the Accounts Context boundary."
  defdelegate profiles_error_cat_session_expired(arg1),
    to: GroupherServer.Accounts.Profiles.ErrorCat,
    as: :session_expired

  @doc "Delegates Accounts.Profiles.ErrorCat.account_blocked/1 through the Accounts Context boundary."
  defdelegate profiles_error_cat_account_blocked(arg1),
    to: GroupherServer.Accounts.Profiles.ErrorCat,
    as: :account_blocked

  @doc "Delegates Accounts.Profiles.ErrorCat.session_unavailable/1 through the Accounts Context boundary."
  defdelegate profiles_error_cat_session_unavailable(arg1),
    to: GroupherServer.Accounts.Profiles.ErrorCat,
    as: :session_unavailable

  @doc "Delegates Accounts.Profiles.ErrorCat.invalid_browser_access_claims/1 through the Accounts Context boundary."
  defdelegate profiles_error_cat_invalid_browser_access_claims(arg1),
    to: GroupherServer.Accounts.Profiles.ErrorCat,
    as: :invalid_browser_access_claims

  @doc "Delegates Accounts.Profiles.ErrorCat.not_exist/0 through the Accounts Context boundary."
  defdelegate profiles_error_cat_not_exist(),
    to: GroupherServer.Accounts.Profiles.ErrorCat,
    as: :not_exist

  @doc "Delegates Accounts.Profiles.ErrorCat.not_exist/1 through the Accounts Context boundary."
  defdelegate profiles_error_cat_not_exist(arg1),
    to: GroupherServer.Accounts.Profiles.ErrorCat,
    as: :not_exist
end
