defmodule GroupherServerWeb.Resolvers.Accounts.Profiles do
  @moduledoc """
  Adapts profile GraphQL fields to public Accounts profile use cases.

      GraphQL profile field -> this resolver -> Accounts profile facade
  """
  alias GroupherServer.Accounts
  alias GroupherServer.Pagi

  @doc "Returns the user from the request context, or nil for an anonymous request."
  def me(_root, _args, %{context: %{cur_user: cur_user}}) do
    {:ok, cur_user}
  end

  def me(_root, _args, _info) do
    {:ok, nil}
  end

  @doc "Loads the resolved profile with viewer-specific state when signed in; requires a resolved user."
  def user(_root, %{user: user}, %{context: %{cur_user: cur_user}}) do
    Accounts.profiles_user(user, cur_user)
  end

  def user(_root, %{user: user}, _info) do
    Accounts.profiles_user(user)
  end

  def user(_root, _args, _info) do
    {:error, GroupherServer.Accounts.profiles_error_cat_account_login("need user login name")}
  end

  @doc "Lists user profiles with the supplied filter, pagination, and optional viewer."
  def paged_users(_root, args, %{context: context}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Accounts.profiles_paged_users(
        Map.get(args, :filter) || %{},
        pagi,
        Map.get(context, :cur_user)
      )
    end
  end

  @doc "Updates the signed-in user's profile, including social fields when supplied."
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

  @doc "Lists a user's published articles for one thread with the request's filters and viewer."
  def paged_published_articles(_root, %{user: user, thread: thread} = args, %{context: context}) do
    Accounts.publish_paged_articles(
      user,
      thread,
      Map.get(args, :filter) || %{},
      Map.get(args, :pagi),
      Map.get(context, :cur_user)
    )
  end

  @doc "Lists a user's published comments, optionally restricted to a thread."
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

  def administered_communities(_root, args, %{context: context}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      case Map.get(args, :user) || Map.get(context, :cur_user) do
        nil -> {:error, "login required"}
        user -> Accounts.achievements_paged_administered_communities(user, pagi)
      end
    end
  end

  @doc "Lists the resolved user's community subscriptions with the supplied filter and pagination."
  def subscribed_communities(_root, %{user: user} = args, _info) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Accounts.profiles_subscribed_communities(user, Map.get(args, :filter) || %{}, pagi)
    end
  end

  @doc "Returns community discovery suggestions independently of the viewer's subscriptions."
  def default_community_suggestions(_root, _args, _info) do
    Accounts.profiles_default_community_suggestions()
  end

  @doc "Finds up to 15 accounts by a case-insensitive match on login or nickname."
  def search_users(_root, %{name: name}, _info) do
    Accounts.search_user(name)
  end
end
