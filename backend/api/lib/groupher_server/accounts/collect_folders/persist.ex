defmodule GroupherServer.Accounts.CollectFolders.Persist do
  @moduledoc """
  Owns collection-folder and membership persistence primitives.

  The module validates and builds row operations, but never opens a
  transaction. Commands own the transaction around folder, collect and embed
  updates.

      CollectFolders command
          -> folder counters / CollectFolderEntry primitives
          -> committed folder membership
  """

  import Ecto.Query, warn: false
  import GroupherServer.FrontDesk, only: [thread_of: 1]
  import ShortMaps

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.CollectFolders.ErrorCat
  alias Accounts.Model.{CollectFolder, CollectFolderEntry, Embeds, User}
  alias CMS.Model.{ArticleBinding, Community}
  alias Helper.{Datetime, ORM, T}

  @default_meta Embeds.CollectFolderMeta.default_meta()

  @doc """
  Creates one user-owned collection folder.

  ## Examples

      Accounts.CollectFolders.Persist.create(%{title: "Reading list"}, user)
  """
  @spec create(map(), User.t()) :: T.domain_res(CollectFolder.t())
  def create(%{title: title} = attrs, %User{id: user_id}) do
    case ORM.find_by(CollectFolder, ~m(user_id title)a) do
      {:error, _} ->
        last_updated = Datetime.today() |> Datetime.to_datetime()

        attrs =
          Map.merge(%{user_id: user_id, last_updated: last_updated, meta: @default_meta}, attrs)

        ORM.create(CollectFolder, attrs)

      {:ok, folder} ->
        {:error, ErrorCat.already_exist("#{folder.title} already exists")}
    end
  end

  @doc """
  Updates editable folder fields and its last-updated date.

  ## Examples

      Accounts.CollectFolders.Persist.update(folder_id, %{title: "Read later"})
  """
  @spec update(T.id(), map()) :: T.domain_res(CollectFolder.t())
  def update(folder_id, attrs) do
    with {:ok, folder} <- ORM.find(CollectFolder, folder_id) do
      last_updated = Datetime.today() |> Datetime.to_datetime()
      ORM.update(folder, Map.merge(~m(last_updated)a, attrs))
    end
  end

  @doc """
  Deletes an empty collection folder.

  ## Examples

      Accounts.CollectFolders.Persist.delete(folder_id)
  """
  @spec delete(T.id()) :: T.domain_res(CollectFolder.t())
  def delete(id) do
    with {:ok, folder} <- ORM.find(CollectFolder, id) do
      case Repo.exists?(from(entry in CollectFolderEntry, where: entry.folder_id == ^id)) do
        true -> {:error, ErrorCat.delete_no_empty_collect_folder("#{folder.title} is not empty")}
        false -> ORM.find_delete!(CollectFolder, id)
      end
    end
  end

  @doc """
  Validates ownership and returns the canonical folder for adding an article.

  ## Examples

      Accounts.CollectFolders.Persist.prepare_add(article, folder_id, user)
  """
  @spec prepare_add(struct(), T.id(), User.t()) :: {:ok, map()} | {:error, term()}
  def prepare_add(article, folder_id, %User{} = user) do
    with {:ok, thread} <- thread_of(article),
         {:ok, binding} <- resolve_binding(article),
         {:ok, folder} <- ORM.find(CollectFolder, folder_id),
         true <- user.id == folder.user_id,
         {:ok, :pass} <- entry_not_in_folder(folder.id, binding.id) do
      {:ok, %{thread: thread, folder: folder, binding: binding}}
    else
      false -> {:error, ErrorCat.private_collect_folder("folder does not belong to user")}
      error -> error
    end
  end

  @doc """
  Validates ownership and returns the canonical folder for removing an article.

  ## Examples

      Accounts.CollectFolders.Persist.prepare_remove(article, folder_id, user)
  """
  @spec prepare_remove(struct(), T.id(), User.t()) :: {:ok, map()} | {:error, term()}
  def prepare_remove(article, folder_id, %User{} = user) do
    with {:ok, thread} <- thread_of(article),
         {:ok, binding} <- resolve_binding(article),
         {:ok, folder} <- ORM.find(CollectFolder, folder_id),
         true <- user.id == folder.user_id do
      {:ok, %{thread: thread, folder: folder, binding: binding, user_id: user.id}}
    else
      false -> {:error, ErrorCat.private_collect_folder("folder does not belong to user")}
      error -> error
    end
  end

  @doc """
  Adds a binding-scoped entry to a folder in the caller's current transaction.
  The command pipeline owns the transaction itself.

  ## Examples

      Accounts.CollectFolders.Persist.add_in_transaction(folder, :post, binding)
  """
  @spec add_in_transaction(CollectFolder.t(), atom(), ArticleBinding.t()) ::
          T.domain_res(CollectFolder.t())
  def add_in_transaction(folder, thread, %ArticleBinding{} = binding) do
    update_folder_meta(thread, folder, %{
      article_id: binding.article_id,
      article_binding_id: binding.id,
      operation: :add
    })
  end

  @doc """
  Removes a binding-scoped entry from a folder in the caller's current
  transaction. The command pipeline owns the transaction itself.

  ## Examples

      Accounts.CollectFolders.Persist.remove_in_transaction(folder, :post, binding)
  """
  @spec remove_in_transaction(CollectFolder.t(), atom(), ArticleBinding.t(), T.id()) ::
          T.domain_res(map())
  def remove_in_transaction(folder, thread, %ArticleBinding{} = binding, user_id) do
    remove_folder_entry(thread, folder, binding, user_id)
  end

  defp entry_not_in_folder(folder_id, binding_id) do
    if Repo.exists?(
         from(entry in CollectFolderEntry,
           where: entry.folder_id == ^folder_id and entry.article_binding_id == ^binding_id
         )
       ) do
      {:error, ErrorCat.already_collected_in_folder("already collected in this folder")}
    else
      {:ok, :pass}
    end
  end

  defp update_folder_meta(thread, folder, entry_attrs) do
    folder = Repo.get!(CollectFolder, folder.id, lock: "FOR UPDATE")
    delta = if entry_attrs.operation == :add, do: 1, else: -1
    total_count = max(folder.total_count + delta, 0)
    thread_count = max(Map.get(folder.meta, :"#{thread}_count") + delta, 0)
    last_updated = Datetime.today() |> Datetime.to_datetime()

    meta =
      folder.meta
      |> Map.merge(%{"has_#{thread}": thread_count > 0})
      |> Map.merge(%{"#{thread}_count": thread_count})

    with {:ok, folder} <- ORM.update_meta(folder, meta),
         {:ok, folder} <-
           folder
           |> Ecto.Changeset.change(%{total_count: total_count, last_updated: last_updated})
           |> Repo.update(),
         {:ok, _entry} <- persist_entry(entry_attrs, folder.id) do
      {:ok, folder}
    end
  end

  defp remove_folder_entry(thread, folder, binding, user_id) do
    folder = Repo.get!(CollectFolder, folder.id, lock: "FOR UPDATE")

    entry_query =
      from(entry in CollectFolderEntry,
        where:
          entry.folder_id == ^folder.id and
            entry.article_binding_id == ^binding.id,
        lock: "FOR UPDATE"
      )

    case Repo.one(entry_query) do
      nil ->
        {:error, ErrorCat.not_collected_in_folder("article is not collected in this folder")}

      entry ->
        with {1, _} <-
               Repo.delete_all(from(row in CollectFolderEntry, where: row.id == ^entry.id)),
             {:ok, updated_folder} <- decrement_folder_meta(thread, folder) do
          remaining_in_folder? =
            Repo.exists?(
              from(row in CollectFolderEntry,
                where: row.folder_id == ^folder.id and row.article_id == ^binding.article_id
              )
            )

          remaining_in_account? =
            Repo.exists?(
              from(row in CollectFolderEntry,
                join: owned_folder in CollectFolder,
                on: owned_folder.id == row.folder_id,
                where: owned_folder.user_id == ^user_id and row.article_id == ^binding.article_id
              )
            )

          {:ok,
           %{
             folder: updated_folder,
             remaining_in_folder?: remaining_in_folder?,
             remaining_in_account?: remaining_in_account?
           }}
        else
          error -> error
        end
    end
  end

  defp decrement_folder_meta(thread, folder) do
    delta = -1
    total_count = max(folder.total_count + delta, 0)
    thread_count = max(Map.get(folder.meta, :"#{thread}_count") + delta, 0)
    last_updated = Datetime.today() |> Datetime.to_datetime()

    meta =
      folder.meta
      |> Map.merge(%{"has_#{thread}": thread_count > 0})
      |> Map.merge(%{"#{thread}_count": thread_count})

    with {:ok, folder} <- ORM.update_meta(folder, meta),
         {:ok, folder} <-
           folder
           |> Ecto.Changeset.change(%{total_count: total_count, last_updated: last_updated})
           |> Repo.update() do
      {:ok, folder}
    end
  end

  defp persist_entry(attrs, folder_id) do
    case Map.fetch!(attrs, :operation) do
      :remove ->
        Repo.delete_all(
          from(entry in CollectFolderEntry,
            where:
              entry.folder_id == ^folder_id and
                entry.article_binding_id == ^attrs.article_binding_id
          )
        )

        {:ok, :removed}

      :add ->
        attrs
        |> Map.drop([:operation])
        |> Map.put(:folder_id, folder_id)
        |> then(&(%CollectFolderEntry{} |> CollectFolderEntry.changeset(&1)))
        |> Repo.insert()
    end
  end

  defp resolve_binding(article) do
    case Map.get(article, :community) do
      %Community{} = community ->
        case CMS.articles_bindings_get(article, community) do
          {:ok, %{binding: %ArticleBinding{} = binding}} -> {:ok, binding}
          {:error, _reason} = error -> error
        end

      _ ->
        case CMS.articles_bindings_all(article) do
          {:ok, [%ArticleBinding{} = binding]} ->
            {:ok, binding}

          {:ok, _bindings} ->
            {:error, ErrorCat.binding_context_required()}

          {:error, _reason} = error ->
            error
        end
    end
  end
end
