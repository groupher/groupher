defmodule GroupherServer.Accounts.CollectFolders do
  @moduledoc """
  Public account boundary for collection-folder reads, writes, and article membership.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> CollectFolders
        -> Repo
  """

  alias __MODULE__.{Articles, CommandResult, List, Write}
  alias GroupherServer.Accounts

  alias Accounts.Model.User
  alias Helper.T

  @doc "Runs `paged` through the public `CollectFolders` boundary."
  @spec paged(User.t(), map()) :: T.domain_res(T.paged_data())
  def paged(%User{id: user_id}, filter), do: List.page(user_id, filter)

  @spec paged(User.t(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged(%User{id: user_id}, filter, %User{} = cur_user) do
    List.page(user_id, filter, cur_user)
  end

  @doc "Returns paged articles from the `CollectFolders` read boundary."
  @spec paged_articles(T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_articles(folder_id, filter), do: Articles.paged(folder_id, filter)

  @spec paged_articles(T.id(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged_articles(folder_id, filter, %User{} = cur_user) do
    Articles.paged(folder_id, filter, cur_user)
  end

  @doc "Runs `create` through the public `CollectFolders` boundary."
  @spec create(map(), User.t()) :: T.domain_res(term())
  def create(attrs, %User{} = user), do: Write.create(attrs, user)

  @doc "Runs `update` through the public `CollectFolders` boundary."
  @spec update(T.id(), map()) :: T.domain_res(term())
  def update(folder_id, attrs), do: Write.update(folder_id, attrs)

  @doc "Runs `delete` through the public `CollectFolders` boundary."
  @spec delete(T.id()) :: T.domain_res(term())
  def delete(folder_id), do: Write.delete(folder_id)

  @doc "Runs `add` through the public `CollectFolders` boundary."
  @spec add(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def add(article, folder_id, %User{} = user), do: Write.add(article, folder_id, user)

  @doc "Runs retry-safe collect membership addition and returns its mutation payload."
  def add_payload(article, folder_id, %User{} = user, command_id) do
    Write.add_payload(article, folder_id, user, command_id)
  end

  @doc "Adds collect membership and returns the complete Accounts-owned command result."
  def add_result(article, folder_id, %User{} = user, command_id) do
    article
    |> Write.add_payload(folder_id, user, command_id)
    |> CommandResult.build(article, user)
  end

  @doc "Runs `remove` through the public `CollectFolders` boundary."
  @spec remove(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def remove(article, folder_id, %User{} = user), do: Write.remove(article, folder_id, user)

  @doc "Runs retry-safe collect membership removal and returns its mutation payload."
  def remove_payload(article, folder_id, %User{} = user, command_id) do
    Write.remove_payload(article, folder_id, user, command_id)
  end

  @doc "Removes collect membership and returns the complete Accounts-owned command result."
  def remove_result(article, folder_id, %User{} = user, command_id) do
    article
    |> Write.remove_payload(folder_id, user, command_id)
    |> CommandResult.build(article, user)
  end
end
