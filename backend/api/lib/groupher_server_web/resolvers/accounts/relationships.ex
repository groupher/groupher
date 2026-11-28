defmodule GroupherServerWeb.Resolvers.Accounts.Relationships do
  @moduledoc """
  Adapts relationship and collection GraphQL fields to their Accounts owners.

      GraphQL relationship field -> this resolver -> Accounts relationship/collect facade
  """
  alias GroupherServer.Accounts
  alias GroupherServer.Pagi

  @doc "Makes the signed-in viewer follow the resolved user."
  def follow(_root, %{user: user}, %{context: %{cur_user: cur_user}}) do
    Accounts.follow_user(cur_user, user)
  end

  @doc "Removes the viewer's follow relationship with the resolved user."
  def undo_follow(_root, %{user: user}, %{context: %{cur_user: cur_user}}) do
    Accounts.unfollow_user(cur_user, user)
  end

  @doc "Lists accounts following the resolved user, including follow state for the viewer."
  def paged_followers(_root, %{user: user} = args, %{context: context}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Accounts.page_followers(
        user,
        Map.get(args, :filter) || %{},
        pagi,
        Map.get(context, :cur_user)
      )
    end
  end

  @doc "Lists accounts the resolved user follows, including follow state for the viewer."
  def paged_followings(_root, %{user: user} = args, %{context: context}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Accounts.page_followed_users(
        user,
        Map.get(args, :filter) || %{},
        pagi,
        Map.get(context, :cur_user)
      )
    end
  end

  @doc "Lists articles upvoted by the resolved user, with filtering and pagination."
  def paged_upvoted_articles(_root, %{user: user} = args, _info) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Accounts.page_upvoted_articles(user, Map.get(args, :filter) || %{}, pagi)
    end
  end

  @doc "Creates a collection folder owned by the signed-in user."
  def create_collect_folder(_root, attrs, %{context: %{cur_user: cur_user}}) do
    Accounts.create_collect_folder(attrs, cur_user)
  end

  @doc "Updates the collection folder identified by the supplied ID and attributes."
  def update_collect_folder(_root, %{id: id} = attrs, _) do
    Accounts.update_collect_folder(id, attrs)
  end

  @doc "Deletes a collection folder by ID through Accounts."
  def delete_collect_folder(_root, %{id: id}, _) do
    Accounts.delete_collect_folder(id)
  end

  @doc "Adds the resolved article to a folder for the viewer and returns the command result."
  def add_to_collect(_root, %{article: article, folder_id: folder_id} = args, %{
        context: %{cur_user: cur_user}
      }) do
    Accounts.collect_folders_add_result(article, folder_id, cur_user, Map.get(args, :command_id))
  end

  @doc "Removes the resolved article from a folder for the viewer and returns the command result."
  def remove_from_collect(_root, %{article: article, folder_id: folder_id} = args, %{
        context: %{cur_user: cur_user}
      }) do
    Accounts.collect_folders_remove_result(
      article,
      folder_id,
      cur_user,
      Map.get(args, :command_id)
    )
  end

  @doc "Lists a user's folders; only the owner sees private folders."
  def paged_collect_folders(_root, %{user: user} = args, %{context: context}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Accounts.collect_folders_paged(
        user,
        Map.get(args, :filter) || %{},
        pagi,
        Map.get(context, :cur_user)
      )
    end
  end

  @doc "Lists articles in one folder, passing the viewer to Accounts for visibility checks."
  def paged_collected_articles(_root, %{folder_id: folder_id} = args, %{context: context}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Accounts.collect_folders_paged_articles(
        folder_id,
        Map.get(args, :filter) || %{},
        pagi,
        Map.get(context, :cur_user)
      )
    end
  end
end
