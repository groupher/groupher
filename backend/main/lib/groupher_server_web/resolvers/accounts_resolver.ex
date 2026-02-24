defmodule GroupherServerWeb.Resolvers.Accounts do
  @moduledoc """
  accounts resolvers
  """
  import ShortMaps
  import Helper.ErrorCode

  alias GroupherServer.{Accounts, CMS}

  alias GroupherServer.Accounts.Model.User
  alias Helper.Certification

  def me(_root, _args, %{context: %{cur_user: cur_user}}), do: {:ok, cur_user}

  def user(_root, %{user: user}, %{context: %{cur_user: cur_user}}) do
    Accounts.read_user(user, cur_user)
  end

  def user(_root, %{user: user}, _info), do: Accounts.read_user(user)
  def user(_root, _args, _info), do: raise_error(:account_login, "need user login name")

  def paged_users(_root, ~m(filter)a, %{context: %{cur_user: cur_user}}) do
    Accounts.paged_users(filter, cur_user)
  end

  def paged_users(_root, ~m(filter)a, _info), do: Accounts.paged_users(filter)

  def session_state(_root, _args, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.subscribe_default_ifnot(cur_user)
    {:ok, %{is_valid: true, user: cur_user}}
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

    Accounts.update_profile(%User{id: cur_user.id}, profile)
  end

  def signin_oauth(_root, %{provider: provider}, _info) do
    Accounts.signin_oauth(provider)
  end

  def link_oauth(_root, %{provider: provider}, %{context: %{cur_user: cur_user}}) do
    Accounts.link_oauth(cur_user.login, provider)
  end

  def unlink_oauth(_root, %{provider: provider}, %{context: %{cur_user: cur_user}}) do
    Accounts.unlink_oauth(cur_user.login, provider)
  end

  def get_customization(_root, _args, %{context: %{cur_user: cur_user}}) do
    Accounts.get_customization(cur_user)
  end

  # def set_customization(_root, ~m(user_id customization)a, %{context: %{cur_user: cur_user}}) do
  # Accounts.set_customization(%User{id: user_id}, customization)
  # end

  def set_customization(_root, args, %{context: %{cur_user: cur_user}}) do
    customization = add_c11n_communities_index_ifneed(args)
    Accounts.set_customization(cur_user, customization)
  end

  def set_customization(_root, _args, _info) do
    {:error, [message: "need login", code: ecode(:account_login)]}
  end

  def follow(_root, ~m(login)a, %{context: %{cur_user: cur_user}}) do
    case Accounts.get_userid_and_cache(login) do
      {:ok, user_id} -> Accounts.follow(cur_user, %User{id: user_id})
      _ -> raise_error(:not_exist, "#{login} not found")
    end
  end

  def undo_follow(_root, ~m(login)a, %{context: %{cur_user: cur_user}}) do
    case Accounts.get_userid_and_cache(login) do
      {:ok, user_id} -> Accounts.undo_follow(cur_user, %User{id: user_id})
      _ -> raise_error(:not_exist, "#{login} not found")
    end
  end

  def paged_followers(_root, ~m(login filter)a, %{context: %{cur_user: cur_user}}) do
    case Accounts.get_userid_and_cache(login) do
      {:ok, user_id} -> Accounts.paged_followers(%User{id: user_id}, filter, cur_user)
      _ -> raise_error(:not_exist, "#{login} not found")
    end
  end

  def paged_followers(_root, ~m(login filter)a, _info) do
    case Accounts.get_userid_and_cache(login) do
      {:ok, user_id} -> Accounts.paged_followers(%User{id: user_id}, filter)
      _ -> raise_error(:not_exist, "#{login} not found")
    end
  end

  def paged_followings(_root, ~m(login filter)a, %{context: %{cur_user: cur_user}}) do
    case Accounts.get_userid_and_cache(login) do
      {:ok, user_id} -> Accounts.paged_followings(%User{id: user_id}, filter, cur_user)
      _ -> raise_error(:not_exist, "#{login} not found")
    end
  end

  def paged_followings(_root, ~m(login filter)a, _info) do
    case Accounts.get_userid_and_cache(login) do
      {:ok, user_id} -> Accounts.paged_followings(%User{id: user_id}, filter)
      _ -> raise_error(:not_exist, "#{login} not found")
    end
  end

  def paged_upvoted_articles(_root, ~m(login filter)a, _info) do
    case Accounts.get_userid_and_cache(login) do
      {:ok, user_id} -> Accounts.paged_upvoted_articles(user_id, filter)
      _ -> raise_error(:not_exist, "#{login} not found")
    end
  end

  def create_collect_folder(_root, attrs, %{context: %{cur_user: cur_user}}) do
    Accounts.create_collect_folder(attrs, cur_user)
  end

  def update_collect_folder(_root, %{id: id} = attrs, _) do
    Accounts.update_collect_folder(id, attrs)
  end

  def delete_collect_folder(_root, %{id: id}, _) do
    Accounts.delete_collect_folder(id)
  end

  def add_to_collect(_root, ~m(article folder_id)a, %{context: %{cur_user: cur_user}}) do
    Accounts.add_to_collect(article, folder_id, cur_user)
  end

  def remove_from_collect(_root, ~m(article folder_id)a, %{
        context: %{cur_user: cur_user}
      }) do
    Accounts.remove_from_collect(article, folder_id, cur_user)
  end

  def paged_collect_folders(_root, ~m(login filter)a, %{context: %{cur_user: cur_user}}) do
    with {:ok, user_id} <- Accounts.get_userid_and_cache(login) do
      Accounts.paged_collect_folders(user_id, filter, cur_user)
    end
  end

  def paged_collect_folders(_root, ~m(login filter)a, _info) do
    case Accounts.get_userid_and_cache(login) do
      {:ok, user_id} -> Accounts.paged_collect_folders(user_id, filter)
      _ -> raise_error(:not_exist, "#{login} not found")
    end
  end

  def paged_collected_articles(_root, ~m(folder_id filter)a, %{context: %{cur_user: cur_user}}) do
    Accounts.paged_collect_folder_articles(folder_id, filter, cur_user)
  end

  def paged_collected_articles(_root, ~m(folder_id filter)a, _info) do
    Accounts.paged_collect_folder_articles(folder_id, filter)
  end

  # published contents
  def paged_published_articles(_root, ~m(login filter thread)a, _info) do
    case Accounts.get_userid_and_cache(login) do
      {:ok, user_id} -> Accounts.paged_published_articles(%User{id: user_id}, thread, filter)
      _ -> raise_error(:not_exist, "#{login} not found")
    end
  end

  def paged_published_articles(_root, ~m(filter thread)a, %{context: %{cur_user: cur_user}}) do
    Accounts.paged_published_articles(cur_user, thread, filter)
  end

  def paged_published_comments(_root, ~m(login filter thread)a, _info) do
    case Accounts.get_userid_and_cache(login) do
      {:ok, user_id} -> Accounts.paged_published_comments(%User{id: user_id}, thread, filter)
      _ -> raise_error(:not_exist, "#{login} not found")
    end
  end

  def paged_published_comments(_root, ~m(login filter)a, _info) do
    case Accounts.get_userid_and_cache(login) do
      {:ok, user_id} -> Accounts.paged_published_comments(%User{id: user_id}, filter)
      _ -> raise_error(:not_exist, "#{login} not found")
    end
  end

  # paged communities which the user it's the moderator
  def moderatorable_communities(_root, ~m(login filter)a, _info) do
    case Accounts.get_userid_and_cache(login) do
      {:ok, user_id} -> Accounts.paged_moderatorable_communities(%User{id: user_id}, filter)
      _ -> raise_error(:not_exist, "#{login} not found")
    end
  end

  def moderatorable_communities(_root, ~m(filter)a, %{context: %{cur_user: cur_user}}) do
    Accounts.paged_moderatorable_communities(cur_user, filter)
  end

  # mailbox
  def mailbox_status(_root, _args, %{context: %{cur_user: cur_user}}) do
    Accounts.mailbox_status(cur_user)
  end

  def mark_read(_root, ~m(type ids)a, %{context: %{cur_user: cur_user}}) do
    Accounts.mark_read(type, ids, cur_user)
  end

  def mark_read_all(_root, ~m(type)a, %{context: %{cur_user: cur_user}}) do
    Accounts.mark_read_all(type, cur_user)
  end

  def paged_mailbox_mentions(_root, ~m(filter)a, %{context: %{cur_user: cur_user}}) do
    Accounts.paged_mailbox_messages(:mention, cur_user, filter)
  end

  def paged_mailbox_notifications(_root, ~m(filter)a, %{context: %{cur_user: cur_user}}) do
    Accounts.paged_mailbox_messages(:notification, cur_user, filter)
  end

  # mailbox end

  # for check other users subscribed_communities
  def subscribed_communities(_root, %{login: login, filter: filter}, _info) do
    case Accounts.get_userid_and_cache(login) do
      {:ok, user_id} -> Accounts.subscribed_communities(%User{id: user_id}, filter)
      _ -> raise_error(:not_exist, "#{login} not found")
    end
  end

  def subscribed_communities(_root, %{filter: filter}, _info) do
    Accounts.default_subscribed_communities(filter)
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
    cms_rules = Certification.all_rules(:cms, :stringify)

    {:ok, %{cms: cms_rules}}
  end

  # def create_user(_root, args, %{context: %{cur_user: %{root: true}}}) do
  # Accounts.create_user2(args)
  # end
  def search_users(_root, %{name: name}, _info) do
    Accounts.search_users(%{name: name})
  end

  defp add_c11n_communities_index_ifneed(~m(customization)a = args) do
    case Map.has_key?(args, :sidebar_communities_index) do
      true ->
        sidebar_communities_index =
          try do
            args
            |> Map.get(:sidebar_communities_index, [])
            |> Enum.map(fn %{community: c, index: i} -> {c, i} end)
            |> Map.new()
          rescue
            _ -> %{}
          end

        Map.merge(customization, %{sidebar_communities_index: sidebar_communities_index})

      false ->
        customization
    end
  end
end
