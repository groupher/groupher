defmodule GroupherServerWeb.Resolvers.Accounts do
  @moduledoc """
  accounts resolvers
  """
  import ShortMaps
  import Helper.ErrorCode

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias GroupherServer.CMS.Gate.Passport.Registry

  def me(_root, _args, %{context: %{cur_user: cur_user}}), do: {:ok, cur_user}
  def me(_root, _args, _info), do: {:ok, nil}

  def user(_root, %{user: user}, %{context: %{cur_user: cur_user}}) do
    Accounts.Profiles.read_user(user, cur_user)
  end

  def user(_root, %{user: user}, _info), do: Accounts.Profiles.read_user(user)
  def user(_root, _args, _info), do: raise_error(:account_login, "need user login name")

  def paged_users(_root, ~m(filter)a, %{context: %{cur_user: cur_user}}) do
    Accounts.Profiles.paged_users(filter, cur_user)
  end

  def paged_users(_root, ~m(filter)a, _info), do: Accounts.Profiles.paged_users(filter)

  def session_state(_root, _args, %{context: %{auth_failure: code}}) do
    {:error, [message: "Authorize: browser token is invalid", code: code]}
  end

  def session_state(_root, _args, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.subscribe_default_ifnot(cur_user)

    {:ok,
     %{
       delegation_subject: Accounts.Profiles.delegation_subject(cur_user),
       is_valid: true,
       user: cur_user
     }}
  end

  def session_state(_root, _args, _info), do: {:ok, %{is_valid: false}}

  def update_profile(_root, args, %{context: %{cur_user: cur_user}}) do
    profile =
      if Map.has_key?(args, :profile),
        do: args.profile,
        else: %{}

    profile =
      if Map.has_key?(args, :social),
        do: Map.merge(profile, %{social: args.social}),
        else: profile

    Accounts.Profiles.update_profile(cur_user, profile)
  end

  def signin_oauth(_root, %{provider: provider} = args, _info) do
    Accounts.Profiles.signin_oauth(provider, Map.get(args, :browser_session, %{}))
  end

  def refresh_browser_session(_root, %{browser_session_ref: ref}, _info) do
    ref |> Accounts.Profiles.refresh_browser_session() |> browser_session_result()
  end

  def revoke_browser_session(_root, %{browser_session_ref: ref}, _info) do
    with {:ok, _result} <- Accounts.Profiles.revoke_browser_session(ref),
         do: {:ok, %{done: true}}
  end

  def browser_sessions(_root, %{browser_session_ref: ref}, _info) do
    ref |> Accounts.Profiles.browser_sessions_for_ref() |> browser_session_result()
  end

  def revoke_browser_session_public(
        _root,
        %{browser_session_ref: ref, public_ref: public_ref},
        _info
      ) do
    ref
    |> Accounts.Profiles.revoke_browser_session_public(public_ref)
    |> browser_session_result()
  end

  def revoke_other_browser_sessions(_root, %{browser_session_ref: ref}, _info) do
    with {:ok, _result} <-
           ref
           |> Accounts.Profiles.revoke_other_browser_sessions_for_ref()
           |> browser_session_result(),
         do: {:ok, %{done: true}}
  end

  defp browser_session_result({:error, reason}) do
    {message, code} =
      case reason do
        :session_expired ->
          {"Browser Session expired.", "SESSION_EXPIRED"}

        :session_revoked ->
          {"Browser Session revoked.", "SESSION_REVOKED"}

        :session_not_found ->
          {"Browser Session no longer exists.", "SESSION_REVOKED"}

        :current_session ->
          {"The current Browser Session cannot be revoked here.", "SESSION_CONFLICT"}

        :account_blocked ->
          {"Account is blocked.", "ACCOUNT_BLOCKED"}

        _ ->
          {"Browser Session operation failed.", "SESSION_UNAVAILABLE"}
      end

    {:error, [message: message, code: code]}
  end

  defp browser_session_result(result), do: result

  def linked_oauth_accounts(_root, _args, %{context: %{cur_user: cur_user}}) do
    Accounts.Profiles.linked_oauth_accounts(cur_user.login)
  end

  def link_oauth_identity(_root, %{identity: identity}, %{context: %{cur_user: cur_user}}) do
    Accounts.Profiles.link_oauth_identity(cur_user.login, identity)
  end

  def unlink_oauth_identity(_root, %{public_ref: public_ref}, %{
        context: %{cur_user: cur_user}
      }) do
    Accounts.Profiles.unlink_oauth_identity(cur_user.login, public_ref)
  end

  def follow(_root, %{user: user}, %{context: %{cur_user: cur_user}}) do
    Accounts.Fans.follow(cur_user, user)
  end

  def undo_follow(_root, %{user: user}, %{context: %{cur_user: cur_user}}) do
    Accounts.Fans.undo_follow(cur_user, user)
  end

  def paged_followers(_root, %{user: user, filter: filter}, %{context: %{cur_user: cur_user}}) do
    Accounts.Fans.paged_followers(user, filter, cur_user)
  end

  def paged_followers(_root, %{user: user, filter: filter}, _info) do
    Accounts.Fans.paged_followers(user, filter)
  end

  def paged_followings(_root, %{user: user, filter: filter}, %{context: %{cur_user: cur_user}}) do
    Accounts.Fans.paged_followings(user, filter, cur_user)
  end

  def paged_followings(_root, %{user: user, filter: filter}, _info) do
    Accounts.Fans.paged_followings(user, filter)
  end

  def paged_upvoted_articles(_root, %{user: user, filter: filter}, _info) do
    Accounts.Upvotes.paged_articles(user, filter)
  end

  def create_collect_folder(_root, attrs, %{context: %{cur_user: cur_user}}) do
    Accounts.CollectFolders.create(attrs, cur_user)
  end

  def update_collect_folder(_root, %{id: id} = attrs, _) do
    Accounts.CollectFolders.update(id, attrs)
  end

  def delete_collect_folder(_root, %{id: id}, _) do
    Accounts.CollectFolders.delete(id)
  end

  def add_to_collect(_root, ~m(article folder_id)a, %{context: %{cur_user: cur_user}}) do
    Accounts.CollectFolders.add(article, folder_id, cur_user)
  end

  def remove_from_collect(_root, ~m(article folder_id)a, %{
        context: %{cur_user: cur_user}
      }) do
    Accounts.CollectFolders.remove(article, folder_id, cur_user)
  end

  def paged_collect_folders(_root, %{user: user, filter: filter}, %{
        context: %{cur_user: cur_user}
      }) do
    Accounts.CollectFolders.paged(user, filter, cur_user)
  end

  def paged_collect_folders(_root, %{user: user, filter: filter}, _info) do
    Accounts.CollectFolders.paged(user, filter)
  end

  def paged_collected_articles(_root, ~m(folder_id filter)a, %{context: %{cur_user: cur_user}}) do
    Accounts.CollectFolders.paged_articles(folder_id, filter, cur_user)
  end

  def paged_collected_articles(_root, ~m(folder_id filter)a, _info) do
    Accounts.CollectFolders.paged_articles(folder_id, filter)
  end

  # published contents
  def paged_published_articles(_root, %{user: user, filter: filter, thread: thread}, _info) do
    Accounts.Publish.paged_articles(user, thread, filter)
  end

  def paged_published_articles(_root, ~m(filter thread)a, %{context: %{cur_user: cur_user}}) do
    Accounts.Publish.paged_articles(cur_user, thread, filter)
  end

  def paged_published_comments(_root, %{user: user, filter: filter, thread: thread}, _info) do
    Accounts.Publish.paged_comments(user, thread, filter)
  end

  def paged_published_comments(_root, %{user: user, filter: filter}, _info) do
    Accounts.Publish.paged_comments(user, filter)
  end

  # paged communities which the user it's the moderator
  def moderatorable_communities(_root, %{user: user, filter: filter}, _info) do
    Accounts.Achievements.paged_moderatorable_communities(user, filter)
  end

  def moderatorable_communities(_root, ~m(filter)a, %{context: %{cur_user: cur_user}}) do
    Accounts.Achievements.paged_moderatorable_communities(cur_user, filter)
  end

  # mailbox
  def mailbox_status(_root, _args, %{context: %{cur_user: cur_user}}) do
    Accounts.Mailbox.status(cur_user)
  end

  def mark_read(_root, ~m(type ids)a, %{context: %{cur_user: cur_user}}) do
    Accounts.Mailbox.mark_read(type, ids, cur_user)
  end

  def mark_read_all(_root, ~m(type)a, %{context: %{cur_user: cur_user}}) do
    Accounts.Mailbox.mark_read_all(type, cur_user)
  end

  def paged_mailbox_mentions(_root, ~m(filter)a, %{context: %{cur_user: cur_user}}) do
    Accounts.Mailbox.paged_messages(:mention, cur_user, filter)
  end

  def paged_mailbox_notifications(_root, ~m(filter)a, %{context: %{cur_user: cur_user}}) do
    Accounts.Mailbox.paged_messages(:notification, cur_user, filter)
  end

  # mailbox end

  # for check other users subscribed_communities
  def subscribed_communities(_root, %{user: user, filter: filter}, _info) do
    Accounts.Profiles.subscribed_communities(user, filter)
  end

  def subscribed_communities(_root, %{filter: filter}, _info) do
    Accounts.Profiles.default_subscribed_communities(filter)
  end

  def get_passport(root, _args, %{context: %{cur_user: _}}) do
    CMS.Communities.get_passport(%User{id: root.id})
  end

  def get_passport_string(root, _args, %{context: %{cur_user: _}}) do
    with {:ok, passport} <- CMS.Communities.get_passport(%User{id: root.id}) do
      {:ok, Jason.encode!(passport)}
    end
  end

  def get_all_rules(_root, _args, %{context: %{cur_user: _}}) do
    cms_rules = Registry.all_rules(:cms, :stringify)

    {:ok, %{cms: cms_rules}}
  end

  # def create_user(_root, args, %{context: %{cur_user: %{root: true}}}) do
  # Accounts.create_user2(args)
  # end
  def search_users(_root, %{name: name}, _info) do
    Accounts.Search.user(name)
  end
end
