defmodule GroupherServerWeb.Resolvers.Accounts.Profiles do
  @moduledoc """
  Adapts profile GraphQL fields to public Accounts profile use cases.

      GraphQL profile field -> this resolver -> Accounts profile facade
  """
  alias GroupherServer.Accounts
  alias GroupherServer.Pagi

  def me(_root, _args, %{context: %{cur_user: cur_user}}) do
    {:ok, cur_user}
  end

  def me(_root, _args, _info) do
    {:ok, nil}
  end

  def user(_root, %{user: user}, %{context: %{cur_user: cur_user}}) do
    Accounts.profiles_user(user, cur_user)
  end

  def user(_root, %{user: user}, _info) do
    Accounts.profiles_user(user)
  end

  def user(_root, _args, _info) do
    {:error, GroupherServer.Accounts.profiles_error_cat_account_login("need user login name")}
  end

  def paged_users(_root, args, %{context: context}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Accounts.profiles_paged_users(
        Map.get(args, :filter) || %{},
        pagi,
        Map.get(context, :cur_user)
      )
    end
  end

  def update_profile(_root, args, %{context: %{cur_user: cur_user}}) do
    profile =
      if Map.has_key?(args, :profile) do
        args.profile
      else
        %{}
      end

    profile =
      if Map.has_key?(args, :social) do
        Map.merge(profile, %{social: args.social})
      else
        profile
      end

    Accounts.profiles_update_profile(cur_user, profile)
  end

  def paged_published_articles(_root, %{user: user, thread: thread} = args, %{context: context}) do
    Accounts.publish_paged_articles(
      user,
      thread,
      Map.get(args, :filter) || %{},
      Map.get(args, :pagi),
      Map.get(context, :cur_user)
    )
  end

  def paged_published_comments(_root, %{user: user} = args, %{context: context}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Accounts.publish_paged_comments(
        user,
        Map.get(args, :thread),
        Map.get(args, :filter) || %{},
        pagi,
        Map.get(context, :cur_user)
      )
    end
  end

  def moderatorable_communities(_root, args, %{context: context}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      case Map.get(args, :user) || Map.get(context, :cur_user) do
        nil -> {:error, "login required"}
        user -> Accounts.achievements_paged_moderatorable_communities(user, pagi)
      end
    end
  end

  def subscribed_communities(_root, %{user: user} = args, _info) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Accounts.profiles_subscribed_communities(user, Map.get(args, :filter) || %{}, pagi)
    end
  end

  def default_community_suggestions(_root, _args, _info) do
    Accounts.profiles_default_community_suggestions()
  end

  def search_users(_root, %{name: name}, _info) do
    Accounts.search_user(name)
  end
end
