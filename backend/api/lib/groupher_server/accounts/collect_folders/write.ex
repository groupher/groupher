defmodule GroupherServer.Accounts.CollectFolders.Write do
  @moduledoc """
  Mutations for collect folders and their article membership.

  Folder membership is coordinated with the article collect relation so the
  account folder, article collect row, and denormalized folder meta stay aligned.

      add/remove article
          |
          +--> CMS.Articles collect state
          +--> CollectFolder.collects embed
          +--> per-thread counts in folder meta
  """

  import GroupherServer.CMS.FrontDesk, only: [thread_of: 1]
  import GroupherServer.CMS.Artiment.Matcher
  import ShortMaps

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.CollectFolders.ErrorCat
  alias Accounts.Model.{CollectFolder, Embeds, User}
  alias CMS.{Command}
  alias CMS.Accounts.CollectFolders.WriteConfirmation, as: Confirmation
  alias CMS.Model.ArticleCollect
  alias Helper.{Datetime, Multi, ORM, T}

  @default_meta Embeds.CollectFolderMeta.default_meta()

  @doc """
  Creates one user-owned folder with initialized per-thread counters.

  Folder titles are unique within the account. A duplicate title returns the
  CollectFolders domain error instead of overwriting the existing folder.
  """
  @spec create(map(), User.t()) :: T.domain_res(CollectFolder.t())
  def create(%{title: title} = attrs, %User{id: user_id}) do
    case ORM.find_by(CollectFolder, ~m(user_id title)a) do
      {:error, _} ->
        last_updated = Datetime.today() |> Datetime.to_datetime()

        args =
          Map.merge(
            %{user_id: user_id, last_updated: last_updated, meta: @default_meta},
            attrs
          )

        CollectFolder |> ORM.create(args)

      {:ok, folder} ->
        {:error, ErrorCat.already_exist("#{folder.title} already exists")}
    end
  end

  @doc "Updates editable folder fields and advances its last-updated date."
  @spec update(T.id(), map()) :: T.domain_res(CollectFolder.t())
  def update(folder_id, attrs) do
    with {:ok, folder} <- ORM.find(CollectFolder, folder_id) do
      last_updated = Datetime.today() |> Datetime.to_datetime()
      folder |> ORM.update(Map.merge(~m(last_updated)a, attrs))
    end
  end

  @doc "Deletes an empty folder and rejects folders that still own Article membership."
  @spec delete(T.id()) :: T.domain_res(CollectFolder.t())
  def delete(id) do
    with {:ok, folder} <- ORM.find(CollectFolder, id) do
      case Enum.empty?(folder.collects) do
        true -> CollectFolder |> ORM.find_delete!(id)
        false -> {:error, ErrorCat.delete_no_empty_collect_folder("#{folder.title} is not empty")}
      end
    end
  end

  @doc """
  Adds an Article to a folder through the command-backed membership transaction.

  This convenience boundary returns the updated folder; GraphQL callers that
  also need `command_id` and committed projections use `add_payload/4`.
  """
  @spec add(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def add(article, folder_id, %User{} = user) do
    with {:ok, %{folder: folder}} <- add_payload(article, folder_id, user, nil) do
      {:ok, folder}
    end
  end

  @doc "Adds folder membership through the retry-safe CMS Command boundary."
  @spec add_payload(T.article(), T.id(), User.t(), String.t() | nil) :: T.domain_res(map())
  def add_payload(article, folder_id, %User{} = user, nil) do
    add_new(article, folder_id, user)
    |> collect_payload(nil)
  end

  def add_payload(article, folder_id, %User{} = user, command_id) do
    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :collect_add,
      target: article,
      params: %{folder_id: folder_id}
    }

    with {:ok, %Confirmation{data: data}} <-
           Command.execute(command,
             action: fn _context ->
               confirmation(add_new(article, folder_id, user), article, folder_id, :add)
             end,
             confirmation: Confirmation
           ),
         {:ok, folder} <- ORM.find(CollectFolder, data["folder_id"]) do
      collect_payload({:ok, folder}, command_id)
    end
  end

  defp add_new(article, folder_id, %User{} = user) do
    with {:ok, thread} <- thread_of(article),
         {:ok, folder} <- ORM.find(CollectFolder, folder_id),
         {:ok, _} <- article_not_in_folder(article, folder.collects),
         true <- user.id == folder.user_id do
      Multi.new()
      |> Multi.run(:add_article_collect, fn _, _ ->
        ensure_article_collect(article, user)
      end)
      |> Multi.run(:add_to_collect_folder, fn _, %{add_article_collect: article_collect} ->
        collects = [article_collect] ++ folder.collects
        update_folder_meta(thread, collects, folder)
      end)
      |> Multi.run(:set_article_collect_folder, fn _,
                                                   %{
                                                     add_article_collect: article_collect,
                                                     add_to_collect_folder: folder
                                                   } ->
        set_collect_folder(article_collect, folder)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @doc """
  Removes an Article from a folder through the command-backed membership transaction.

  This convenience boundary returns the updated folder; GraphQL callers that
  also need `command_id` and committed projections use `remove_payload/4`.
  """
  @spec remove(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def remove(article, folder_id, %User{} = user) do
    with {:ok, %{folder: folder}} <- remove_payload(article, folder_id, user, nil) do
      {:ok, folder}
    end
  end

  @doc "Removes folder membership through the retry-safe CMS Command boundary."
  @spec remove_payload(T.article(), T.id(), User.t(), String.t() | nil) :: T.domain_res(map())
  def remove_payload(article, folder_id, %User{} = user, nil) do
    remove_new(article, folder_id, user)
    |> collect_payload(nil)
  end

  def remove_payload(article, folder_id, %User{} = user, command_id) do
    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :collect_remove,
      target: article,
      params: %{folder_id: folder_id}
    }

    with {:ok, %Confirmation{data: data}} <-
           Command.execute(command,
             action: fn _context ->
               confirmation(remove_new(article, folder_id, user), article, folder_id, :remove)
             end,
             confirmation: Confirmation
           ),
         {:ok, folder} <- ORM.find(CollectFolder, data["folder_id"]) do
      collect_payload({:ok, folder}, command_id)
    end
  end

  defp remove_new(article, folder_id, %User{} = user) do
    with {:ok, thread} <- thread_of(article),
         {:ok, folder} <- ORM.find(CollectFolder, folder_id),
         true <- user.id == folder.user_id do
      Multi.new()
      |> Multi.run(:del_article_collect, fn _, _ ->
        maybe_remove_article_collect(article, user)
      end)
      |> Multi.run(:rm_from_collect_folder, fn _, %{del_article_collect: article_collect} ->
        collects = Enum.reject(folder.collects, &(&1.id == article_collect.id))
        update_folder_meta(thread, collects, folder)
      end)
      |> Multi.run(:unset_article_collect_folder, fn _,
                                                     %{
                                                       del_article_collect: article_collect,
                                                       rm_from_collect_folder: folder
                                                     } ->
        undo_set_collect_folder(article_collect, folder)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  defp article_not_in_folder(article, collects) do
    with {:ok, thread} <- thread_of(article),
         {:ok, info} <- match(thread) do
      already_collected =
        Enum.any?(collects, fn c -> article.id == Map.get(c, info.foreign_key) end)

      case already_collected do
        true -> {:error, ErrorCat.already_collected_in_folder("already collected in this folder")}
        false -> {:ok, :pass}
      end
    end
  end

  defp ensure_article_collect(article, user) do
    with {:ok, _canonical} <- CMS.Interactions.collect(article, user) do
      ORM.find_by(ArticleCollect, article_collect_args(article, user.id))
    end
  end

  defp maybe_remove_article_collect(article, user) do
    with {:ok, article_collect} <-
           ORM.find_by(ArticleCollect, article_collect_args(article, user.id)) do
      if length(article_collect.collect_folders) <= 1 do
        with {:ok, _canonical} <- CMS.Interactions.undo_collect(article, user) do
          {:ok, article_collect}
        end
      else
        {:ok, article_collect}
      end
    end
  end

  defp article_collect_args(article, user_id) do
    {:ok, thread} = thread_of(article)
    {:ok, info} = match(thread)

    %{thread: thread, user_id: user_id}
    |> Map.put(info.foreign_key, article.id)
  end

  defp set_collect_folder(%ArticleCollect{} = collect, folder) do
    collect_folders = Enum.uniq(collect.collect_folders ++ [folder])
    ORM.update_embed(collect, :collect_folders, collect_folders)
  end

  defp undo_set_collect_folder(%ArticleCollect{} = collect, folder) do
    case Enum.reject(collect.collect_folders, &(&1.id == folder.id)) do
      [] -> {:ok, :pass}
      collect_folders -> ORM.update_embed(collect, :collect_folders, collect_folders)
    end
  end

  defp update_folder_meta(thread, collects, folder) do
    total_count = length(collects)
    last_updated = Datetime.today() |> Datetime.to_datetime()
    thread_count = Enum.count(collects, &(&1.thread == thread))

    meta =
      folder.meta
      |> Map.merge(%{"has_#{thread}": thread_count > 0})
      |> Map.merge(%{"#{thread}_count": thread_count})

    {:ok, folder} = ORM.update_meta(folder, meta)

    folder
    |> Ecto.Changeset.change(%{total_count: total_count, last_updated: last_updated})
    |> Ecto.Changeset.put_embed(:collects, collects)
    |> Repo.update()
  end

  defp result({:ok, %{add_to_collect_folder: result}}), do: {:ok, result}
  defp result({:ok, %{rm_from_collect_folder: result}}), do: {:ok, result}
  defp result({:error, _step, reason, _steps}), do: {:error, reason}

  defp collect_payload({:ok, folder}, command_id),
    do: {:ok, %{folder: folder, command_id: command_id}}

  defp collect_payload({:error, _reason} = error, _command_id), do: error

  defp confirmation({:ok, folder}, article, folder_id, operation) do
    {:ok,
     %Confirmation{
       data: %{
         "folder_id" => to_string(folder_id),
         "article_id" => to_string(article.id),
         "operation" => Atom.to_string(operation),
         "total_count" => folder.total_count
       }
     }}
  end

  defp confirmation(error, _article, _folder_id, _operation), do: error
end
