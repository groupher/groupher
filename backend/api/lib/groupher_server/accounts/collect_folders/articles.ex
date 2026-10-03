defmodule GroupherServer.Accounts.CollectFolders.Articles do
  @moduledoc """
  Paginates articles stored inside a collect folder.

  The folder owns embedded collect refs; this module preloads the concrete
  thread records, applies privacy checks, and extracts a mixed article page for
  the GraphQL layer.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Articles
        -> Repo
  """

  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.CollectFolders.ErrorCat
  alias Accounts.Model.{CollectFolder, User}
  alias CMS.FrontDesk
  alias Helper.{ORM, T}

  @spec paged(T.id(), map()) :: T.domain_res(T.paged_data())
  def paged(folder_id, filter) do
    with {:ok, folder} <- ORM.find(CollectFolder, folder_id) do
      case folder.private do
        true -> {:error, ErrorCat.private_collect_folder("#{folder.title} is private")}
        false -> do_paged(folder, filter)
      end
    end
  end

  @spec paged(T.id(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged(folder_id, filter, %User{id: cur_user_id}) do
    with {:ok, folder} <- ORM.find(CollectFolder, folder_id) do
      is_valid_request = if folder.private, do: folder.user_id == cur_user_id, else: true

      case is_valid_request do
        false -> {:error, ErrorCat.private_collect_folder("#{folder.title} is private")}
        true -> do_paged(folder, filter)
      end
    end
  end

  defp do_paged(folder, filter) do
    paged = ORM.embeds_paginator(folder.collects, filter)

    entries =
      Enum.flat_map(paged.entries, fn collect ->
        case Repo.get(CMS.Model.Article, collect.article_id) |> Repo.preload(:community) do
          %CMS.Model.Article{} = article ->
            case FrontDesk.article(%{
                   community: article.community.slug,
                   thread: article.thread,
                   inner_id: article.inner_id
                 }) do
              {:ok, projection} -> [projection]
              {:error, _reason} -> []
            end

          nil ->
            []
        end
      end)

    paged |> Map.put(:entries, entries) |> done()
  end
end
