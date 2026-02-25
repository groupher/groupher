defmodule GroupherServer.Accounts.CollectFolders.Articles do
  @moduledoc false

  import Helper.ErrorCode
  import Helper.Utils, only: [done: 1, get_config: 2]

  alias GroupherServer.Accounts.Model.{CollectFolder, User}
  alias GroupherServer.Repo
  alias Helper.{ORM, Types}

  @article_threads get_config(:article, :threads)

  @spec paged(Types.id(), map()) :: Types.domain_res(Types.paged_data())
  def paged(folder_id, filter) do
    with {:ok, folder} <- ORM.find(CollectFolder, folder_id) do
      case folder.private do
        true -> raise_error(:private_collect_folder, "#{folder.title} is private")
        false -> do_paged(folder, filter)
      end
    end
  end

  @spec paged(Types.id(), map(), User.t()) :: Types.domain_res(Types.paged_data())
  def paged(folder_id, filter, %User{id: cur_user_id}) do
    with {:ok, folder} <- ORM.find(CollectFolder, folder_id) do
      is_valid_request = if folder.private, do: folder.user_id == cur_user_id, else: true

      case is_valid_request do
        false -> raise_error(:private_collect_folder, "#{folder.title} is private")
        true -> do_paged(folder, filter)
      end
    end
  end

  defp do_paged(folder, filter) do
    article_preload =
      Enum.reduce(@article_threads, [], fn thread, acc ->
        acc ++ Keyword.new([{thread, [author: :user]}])
      end)

    Repo.preload(folder.collects, article_preload)
    |> ORM.embeds_paginator(filter)
    |> ORM.extract_articles()
    |> done()
  end
end
