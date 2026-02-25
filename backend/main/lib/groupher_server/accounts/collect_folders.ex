defmodule GroupherServer.Accounts.CollectFolders do
  @moduledoc """
  Accounts collect folders facade.
  """
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  alias __MODULE__.{Articles, List, Write}

  @spec paged(T.id(), map()) :: T.domain_res(T.paged_data())
  def paged(user_id, filter), do: List.page(user_id, filter)

  @spec paged(T.id(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged(user_id, filter, %User{} = cur_user), do: List.page(user_id, filter, cur_user)

  @spec paged_articles(T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_articles(folder_id, filter), do: Articles.paged(folder_id, filter)

  @spec paged_articles(T.id(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged_articles(folder_id, filter, %User{} = cur_user), do: Articles.paged(folder_id, filter, cur_user)

  @spec create(map(), User.t()) :: T.domain_res(term())
  def create(attrs, %User{} = user), do: Write.create(attrs, user)

  @spec update(T.id(), map()) :: T.domain_res(term())
  def update(folder_id, attrs), do: Write.update(folder_id, attrs)

  @spec delete(T.id()) :: T.domain_res(term())
  def delete(folder_id), do: Write.delete(folder_id)

  @spec add(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def add(article, folder_id, %User{} = user), do: Write.add(article, folder_id, user)

  @spec remove(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def remove(article, folder_id, %User{} = user), do: Write.remove(article, folder_id, user)
end
