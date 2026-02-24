defmodule GroupherServer.Accounts.CollectFolders do
  @moduledoc false

  alias Helper.Types, as: T

  alias GroupherServer.Accounts.Delegate.CollectFolder
  alias GroupherServer.Accounts.Model.{CollectFolder, User}

  @spec paged_collect_folders(T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_collect_folders(user_id, filter),
    do: CollectFolder.paged_collect_folders(user_id, filter)

  @spec paged_collect_folders(T.id(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged_collect_folders(user_id, filter, owner),
    do: CollectFolder.paged_collect_folders(user_id, filter, owner)

  @spec paged_collect_folder_articles(T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_collect_folder_articles(folder_id, filter),
    do: CollectFolder.paged_collect_folder_articles(folder_id, filter)

  @spec paged_collect_folder_articles(T.id(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged_collect_folder_articles(folder_id, filter, user),
    do: CollectFolder.paged_collect_folder_articles(folder_id, filter, user)

  @spec create_collect_folder(map(), User.t()) :: T.domain_res(CollectFolder.t())
  def create_collect_folder(attrs, user), do: CollectFolder.create_collect_folder(attrs, user)

  @spec update_collect_folder(T.id(), map()) :: T.domain_res(CollectFolder.t())
  def update_collect_folder(id, attrs), do: CollectFolder.update_collect_folder(id, attrs)

  @spec delete_collect_folder(T.id()) :: T.domain_res(CollectFolder.t())
  def delete_collect_folder(id), do: CollectFolder.delete_collect_folder(id)

  @spec add_to_collect(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def add_to_collect(article, folder_id, user),
    do: CollectFolder.add_to_collect(article, folder_id, user)

  @spec remove_from_collect(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def remove_from_collect(article, folder_id, user),
    do: CollectFolder.remove_from_collect(article, folder_id, user)
end
