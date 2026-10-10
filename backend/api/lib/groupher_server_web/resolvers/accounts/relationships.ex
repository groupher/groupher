defmodule GroupherServerWeb.Resolvers.Accounts.Relationships do
  @moduledoc """
  Adapts relationship and collection GraphQL fields to their Accounts owners.

      GraphQL relationship field -> this resolver -> Accounts relationship/collect facade
  """
  import ShortMaps
  alias GroupherServer.Accounts

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

  def add_to_collect(_root, %{article: article, folder_id: folder_id} = args, %{
        context: %{cur_user: cur_user}
      }) do
    Accounts.CollectFolders.add_result(article, folder_id, cur_user, Map.get(args, :command_id))
  end

  def remove_from_collect(_root, %{article: article, folder_id: folder_id} = args, %{
        context: %{cur_user: cur_user}
      }) do
    Accounts.CollectFolders.remove_result(
      article,
      folder_id,
      cur_user,
      Map.get(args, :command_id)
    )
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
end
