defmodule GroupherServer.Accounts do
  @moduledoc false

  alias Helper.Types, as: T

  alias GroupherServer.Accounts.Model.{CollectFolder, Customization, User}

  alias __MODULE__.{
    Achievements,
    CollectFolders,
    Customizations,
    Fans,
    Mailboxes,
    Profiles,
    Publishes,
    Searches,
    UpvotedArticles,
    Utils
  }

  @type customization_value ::
          String.t()
          | number()
          | boolean()
          | nil
          | [String.t()]
          | map()

  @spec read_user(User.t()) :: T.domain_res(User.t())
  def read_user(%User{} = user), do: Profiles.read_user(user)

  @spec read_user(User.t(), User.t()) :: T.domain_res(User.t())
  def read_user(%User{} = user, %User{} = cur_user), do: Profiles.read_user(user, cur_user)

  @spec paged_users(map()) :: T.domain_res(T.paged_users())
  def paged_users(filter), do: Profiles.paged_users(filter)

  @spec paged_users(map(), User.t()) :: T.domain_res(T.paged_users())
  def paged_users(filter, %User{} = user), do: Profiles.paged_users(filter, user)

  @spec update_profile(User.t(), map()) :: T.gq_result(User.t())
  def update_profile(%User{} = user, attrs), do: Profiles.update_profile(user, attrs)

  @spec update_subscribe_state(User.t()) :: T.domain_res(User.t())
  def update_subscribe_state(%User{} = user), do: Profiles.update_subscribe_state(user)

  @spec signin_oauth(map()) :: T.domain_res(User.t())
  def signin_oauth(provider), do: Profiles.signin_oauth(provider)

  @spec link_oauth(String.t(), map()) :: T.domain_res(User.t())
  def link_oauth(login, provider), do: Profiles.link_oauth(login, provider)

  @spec unlink_oauth(String.t(), map()) :: T.domain_res(User.t())
  def unlink_oauth(login, provider), do: Profiles.unlink_oauth(login, provider)

  @spec default_subscribed_communities(map()) :: T.domain_res(T.paged_data())
  def default_subscribed_communities(filter), do: Profiles.default_subscribed_communities(filter)

  @spec subscribed_communities(User.t(), map()) :: T.domain_res(T.paged_data())
  def subscribed_communities(%User{} = user, filter),
    do: Profiles.subscribed_communities(user, filter)

  @spec paged_collect_folders(T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_collect_folders(user_id, filter),
    do: CollectFolders.paged_collect_folders(user_id, filter)

  @spec paged_collect_folders(T.id(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged_collect_folders(user_id, filter, %User{} = owner),
    do: CollectFolders.paged_collect_folders(user_id, filter, owner)

  @spec paged_collect_folder_articles(T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_collect_folder_articles(folder_id, filter),
    do: CollectFolders.paged_collect_folder_articles(folder_id, filter)

  @spec paged_collect_folder_articles(T.id(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged_collect_folder_articles(folder_id, filter, %User{} = user),
    do: CollectFolders.paged_collect_folder_articles(folder_id, filter, user)

  @spec create_collect_folder(map(), User.t()) :: T.domain_res(CollectFolder.t())
  def create_collect_folder(attrs, %User{} = user),
    do: CollectFolders.create_collect_folder(attrs, user)

  @spec update_collect_folder(T.id(), map()) :: T.domain_res(CollectFolder.t())
  def update_collect_folder(id, attrs), do: CollectFolders.update_collect_folder(id, attrs)

  @spec delete_collect_folder(T.id()) :: T.domain_res(CollectFolder.t())
  def delete_collect_folder(id), do: CollectFolders.delete_collect_folder(id)

  @spec add_to_collect(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def add_to_collect(article, folder_id, %User{} = user),
    do: CollectFolders.add_to_collect(article, folder_id, user)

  @spec remove_from_collect(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def remove_from_collect(article, folder_id, %User{} = user),
    do: CollectFolders.remove_from_collect(article, folder_id, user)

  @spec achieve(User.t(), atom(), atom()) :: T.domain_res(User.t())
  def achieve(%User{} = user, operation, key), do: Achievements.achieve(user, operation, key)

  @spec paged_moderatorable_communities(User.t(), map()) :: T.domain_res(T.paged_data())
  def paged_moderatorable_communities(%User{} = user, filter),
    do: Achievements.paged_moderatorable_communities(user, filter)

  @spec downgrade_achievement(User.t(), atom(), integer()) :: T.domain_res(User.t())
  def downgrade_achievement(%User{} = user, action, count),
    do: Achievements.downgrade_achievement(user, action, count)

  @spec paged_published_articles(User.t(), T.article_thread(), map()) ::
          T.domain_res(T.paged_data())
  def paged_published_articles(%User{} = user, thread, filter),
    do: Publishes.paged_published_articles(user, thread, filter)

  @spec paged_published_comments(User.t(), T.article_thread(), map()) ::
          T.domain_res(T.paged_data())
  def paged_published_comments(%User{} = user, thread, filter),
    do: Publishes.paged_published_comments(user, thread, filter)

  @spec paged_published_comments(User.t(), T.article_thread()) :: T.domain_res(T.paged_data())
  def paged_published_comments(%User{} = user, thread),
    do: Publishes.paged_published_comments(user, thread)

  @spec update_published_states(User.t(), T.article_thread()) :: T.domain_res(User.t())
  def update_published_states(%User{} = user, thread),
    do: Publishes.update_published_states(user, thread)

  @spec follow(User.t(), User.t()) :: T.gq_result(User.t())
  def follow(%User{} = user, %User{} = follower), do: Fans.follow(user, follower)

  @spec undo_follow(User.t(), User.t()) :: T.gq_result(User.t())
  def undo_follow(%User{} = user, %User{} = follower), do: Fans.undo_follow(user, follower)

  @spec paged_followers(User.t(), map()) :: T.domain_res(T.paged_users())
  def paged_followers(%User{} = user, filter), do: Fans.paged_followers(user, filter)

  @spec paged_followers(User.t(), map(), User.t()) :: T.domain_res(T.paged_users())
  def paged_followers(%User{} = user, filter, %User{} = cur_user),
    do: Fans.paged_followers(user, filter, cur_user)

  @spec paged_followings(User.t(), map()) :: T.domain_res(T.paged_users())
  def paged_followings(%User{} = user, filter), do: Fans.paged_followings(user, filter)

  @spec paged_followings(User.t(), map(), User.t()) :: T.domain_res(T.paged_users())
  def paged_followings(%User{} = user, filter, %User{} = cur_user),
    do: Fans.paged_followings(user, filter, cur_user)

  @spec paged_upvoted_articles(T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_upvoted_articles(user_id, filter),
    do: UpvotedArticles.paged_upvoted_articles(user_id, filter)

  @spec mailbox_status(User.t()) :: T.domain_res(map())
  def mailbox_status(%User{} = user), do: Mailboxes.mailbox_status(user)

  @spec update_mailbox_status(T.id()) :: T.domain_res(User.t())
  def update_mailbox_status(user_id), do: Mailboxes.update_mailbox_status(user_id)

  @spec mark_read(atom(), [T.id()], User.t()) :: T.domain_res(map())
  def mark_read(type, ids, %User{} = user), do: Mailboxes.mark_read(type, ids, user)

  @spec mark_read_all(atom(), User.t()) :: T.domain_res(map())
  def mark_read_all(type, %User{} = user), do: Mailboxes.mark_read_all(type, user)

  @spec paged_mailbox_messages(atom(), User.t(), map()) :: T.domain_res(T.paged_data())
  def paged_mailbox_messages(type, %User{} = user, filter),
    do: Mailboxes.paged_mailbox_messages(type, user, filter)

  @spec get_customization(User.t()) :: T.domain_res(Customization.t())
  def get_customization(%User{} = user), do: Customizations.get_customization(user)

  @spec set_customization(User.t(), atom(), customization_value()) ::
          T.domain_res(Customization.t())
  def set_customization(%User{} = user, key, value),
    do: Customizations.set_customization(user, key, value)

  @spec set_customization(User.t(), map()) :: T.domain_res(Customization.t())
  def set_customization(%User{} = user, options),
    do: Customizations.set_customization(user, options)

  @spec upgrade_by_plan(User.t(), atom()) :: T.domain_res(User.t())
  def upgrade_by_plan(%User{} = user, plan), do: Customizations.upgrade_by_plan(user, plan)

  @spec search_users(map()) :: T.domain_res(T.paged_users())
  def search_users(args), do: Searches.search_users(args)

  @spec get_userid_and_cache(String.t()) :: T.domain_res(T.id())
  def get_userid_and_cache(login), do: Utils.get_userid_and_cache(login)
end
