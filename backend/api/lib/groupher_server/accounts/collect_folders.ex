defmodule GroupherServer.Accounts.CollectFolders do
  @moduledoc """
  Public account boundary for collection-folder reads, writes, and article membership.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Query / Commands
           -> Persist
           -> CMS.Interactions Command / Persist
  """

  alias __MODULE__.{Articles, CommandResult, Commands, List, Persist}
  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.{CollectFolder, User}
  alias CMS.Model.ArticleBinding
  alias Helper.T

  @doc """
  Pages one user's collection folders with optional viewer-aware visibility.

  ## Examples

      Accounts.CollectFolders.paged(user, %{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})
  """
  def paged(%User{id: id}, filter, pagi, viewer \\ nil), do: List.page(id, filter, pagi, viewer)

  @doc """
  Pages the entries in a folder for its owner or an authorized viewer.

  ## Examples

      Accounts.CollectFolders.paged_articles(folder.id, %{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})
  """
  defdelegate paged_articles(folder_id, filter, pagi), to: Articles, as: :paged

  @doc """
  Pages folder entries while applying the requesting viewer's privacy access.

  ## Examples

      Accounts.CollectFolders.paged_articles(folder.id, %{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}, viewer)
  """
  defdelegate paged_articles(folder_id, filter, pagi, viewer), to: Articles, as: :paged

  @doc """
  Creates a user-owned collection folder.

  ## Examples

      Accounts.CollectFolders.create(%{title: "Reading list"}, user)
  """
  @spec create(map(), User.t()) :: T.domain_res(term())
  def create(attrs, %User{} = user), do: Commands.Create.run(attrs, user)

  @doc """
  Updates editable fields on a collection folder.

  ## Examples

      Accounts.CollectFolders.update(folder_id, %{title: "Read later"})
  """
  @spec update(T.id(), map()) :: T.domain_res(term())
  def update(folder_id, attrs), do: Commands.Update.run(folder_id, attrs)

  @doc """
  Deletes an empty collection folder.

  ## Examples

      Accounts.CollectFolders.delete(folder_id)
  """
  @spec delete(T.id()) :: T.domain_res(term())
  def delete(folder_id), do: Commands.Delete.run(folder_id)

  @doc """
  Adds an article to a collection folder and returns the updated folder.

  ## Examples

      Accounts.CollectFolders.add(article, folder_id, user)
  """
  @spec add(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def add(article, folder_id, %User{} = user) do
    with {:ok, %{folder: folder}} <- Commands.Add.run_direct(article, folder_id, user) do
      {:ok, folder}
    end
  end

  @doc """
  Runs retry-safe collect membership addition and returns its mutation payload.

  ## Examples

      Accounts.CollectFolders.add_payload(article, folder_id, user, command_id)
  """
  def add_payload(article, folder_id, %User{} = user, command_id) do
    Commands.Add.run_receipt(article, folder_id, user, command_id)
  end

  @doc """
  Adds collect membership and returns the complete Accounts-owned command result.

  ## Examples

      Accounts.CollectFolders.add_result(article, folder_id, user, command_id)
  """
  def add_result(article, folder_id, %User{} = user, command_id) do
    article
    |> add_payload(folder_id, user, command_id)
    |> CommandResult.build(article, user)
  end

  @doc """
  Removes an article from a collection folder.

  ## Examples

      Accounts.CollectFolders.remove(article, folder_id, user)
  """
  @spec remove(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def remove(article, folder_id, %User{} = user) do
    with {:ok, %{folder: folder}} <- Commands.Remove.run_direct(article, folder_id, user) do
      {:ok, folder}
    end
  end

  @doc """
  Runs retry-safe collect membership removal and returns its mutation payload.

  ## Examples

      Accounts.CollectFolders.remove_payload(article, folder_id, user, command_id)
  """
  def remove_payload(article, folder_id, %User{} = user, command_id) do
    Commands.Remove.run_receipt(article, folder_id, user, command_id)
  end

  @doc """
  Removes collect membership and returns the complete Accounts-owned command result.

  ## Examples

      Accounts.CollectFolders.remove_result(article, folder_id, user, command_id)
  """
  def remove_result(article, folder_id, %User{} = user, command_id) do
    article
    |> remove_payload(folder_id, user, command_id)
    |> CommandResult.build(article, user)
  end

  @doc false
  @spec remove_in_transaction(CollectFolder.t(), atom(), ArticleBinding.t(), T.id()) ::
          T.domain_res(map())
  defdelegate remove_in_transaction(folder, thread, binding, user_id), to: Persist
end
