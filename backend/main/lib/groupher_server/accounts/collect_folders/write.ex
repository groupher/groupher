defmodule GroupherServer.Accounts.CollectFolders.Write do
  @moduledoc false

  import GroupherServer.CMS.FrontDesk, only: [thread_of: 1]
  import GroupherServer.CMS.Helper.Matcher

  import Helper.ErrorCode
  import ShortMaps

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.{CollectFolder, Embeds, User}
  alias Ecto.Multi
  alias Helper.{ORM, T}

  @default_meta Embeds.CollectFolderMeta.default_meta()
  @spec create(map(), User.t()) :: T.domain_res(CollectFolder.t())
  def create(%{title: title} = attrs, %User{id: user_id}) do
    case ORM.find_by(CollectFolder, ~m(user_id title)a) do
      {:error, _} ->
        last_updated = Timex.today() |> Timex.to_datetime()

        args =
          Map.merge(
            %{user_id: user_id, last_updated: last_updated, meta: @default_meta},
            attrs
          )

        CollectFolder |> ORM.create(args)

      {:ok, folder} ->
        raise_error(:already_exist, "#{folder.title} already exists")
    end
  end

  @spec update(T.id(), map()) :: T.domain_res(CollectFolder.t())
  def update(folder_id, attrs) do
    with {:ok, folder} <- ORM.find(CollectFolder, folder_id) do
      last_updated = Timex.today() |> Timex.to_datetime()
      folder |> ORM.update(Map.merge(~m(last_updated)a, attrs))
    end
  end

  @spec delete(T.id()) :: T.domain_res(CollectFolder.t())
  def delete(id) do
    with {:ok, folder} <- ORM.find(CollectFolder, id) do
      case Enum.empty?(folder.collects) do
        true -> CollectFolder |> ORM.find_delete!(id)
        false -> raise_error(:delete_no_empty_collect_folder, "#{folder.title} is not empty")
      end
    end
  end

  @spec add(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def add(article, folder_id, %User{} = user) do
    with {:ok, thread} <- thread_of(article),
         {:ok, folder} <- ORM.find(CollectFolder, folder_id),
         {:ok, _} <- article_not_in_folder(article, folder.collects),
         true <- user.id == folder.user_id do
      Multi.new()
      |> Multi.run(:add_article_collect, fn _, _ ->
        CMS.Articles.collect_ifneed(article, user)
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
        CMS.Articles.set_collect_folder(article_collect, folder)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec remove(T.article(), T.id(), User.t()) :: T.domain_res(T.article())
  def remove(article, folder_id, %User{} = user) do
    with {:ok, thread} <- thread_of(article),
         {:ok, folder} <- ORM.find(CollectFolder, folder_id),
         true <- user.id == folder.user_id do
      Multi.new()
      |> Multi.run(:del_article_collect, fn _, _ ->
        CMS.Articles.undo_collect_ifneed(article, user)
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
        CMS.Articles.undo_set_collect_folder(article_collect, folder)
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
        true -> raise_error(:already_collected_in_folder, "already collected in this folder")
        false -> {:ok, :pass}
      end
    end
  end

  defp update_folder_meta(thread, collects, folder) do
    total_count = length(collects)
    last_updated = Timex.today() |> Timex.to_datetime()
    thread_count = Enum.filter(collects, &(not is_nil(Map.get(&1, :"#{thread}_id")))) |> length()

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
end
