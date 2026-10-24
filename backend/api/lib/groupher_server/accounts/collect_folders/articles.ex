defmodule GroupherServer.Accounts.CollectFolders.Articles do
  @moduledoc """
  Paginates articles stored inside a collect folder.

  The folder owns binding-scoped entry rows; this module pages those rows first,
  then batch-resolves the public ArticleLite paths for the GraphQL layer.

  Business position:

      Accounts facade -> CollectFolders.Articles -> folder scope -> CMS article reads
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.CollectFolders.ErrorCat
  alias Accounts.Model.{CollectFolder, CollectFolderEntry, User}
  alias CMS.Model.{Article, ArticleBinding, Community}
  alias Helper.{ORM, T}
  alias Helper.ORM.Pagi.{Order}
  alias GroupherServer.{Pagi}
  alias Pagi.Params

  @doc """
  Pages folder entries after applying the current viewer's folder privacy.

  ## Examples

      Accounts.CollectFolders.Articles.paged(folder.id, %{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}, viewer)
  """
  @spec paged(T.id(), map(), Params.t() | nil, User.t() | nil) :: tuple()
  def paged(folder_id, filter, pagi, viewer \\ nil) do
    with {:ok, folder} <- ORM.find(CollectFolder, folder_id) do
      if folder.private and
           not match?(%User{id: owner_id} when owner_id == folder.user_id, viewer) do
        {:error, ErrorCat.private_collect_folder("#{folder.title} is private")}
      else
        do_paged(folder, filter, pagi)
      end
    end
  end

  defp do_paged(folder, filter, pagi) do
    query =
      from(entry in CollectFolderEntry,
        join: article in Article,
        on: article.id == entry.article_id,
        join: binding in ArticleBinding,
        on: binding.id == entry.article_binding_id,
        join: community in Community,
        on: community.id == binding.community_id,
        where: entry.folder_id == ^folder.id,
        select: %{
          id: entry.id,
          inserted_at: entry.inserted_at,
          path: %{
            community: community.slug,
            thread: article.thread,
            inner_id: binding.inner_id
          }
        }
      )

    visible = CMS.articles_public_binding_ids()
    query = where(query, [_entry, _article, binding, ...], binding.id in subquery(visible))

    query =
      case Map.get(filter, :thread) do
        thread when is_atom(thread) and not is_nil(thread) ->
          where(query, [entry, article, ...], article.thread == ^thread)

        _ ->
          query
      end

    with {:ok, order} <-
           Order.new(%{
             fields: [:inserted_at, :id],
             directions: [:desc, :desc],
             cursor_fields: [:inserted_at, :id]
           }),
         {:ok, page_result} <-
           ORM.pagi(
             query,
             pagi,
             for: CollectFolderEntry,
             surface: "accounts.collected_articles",
             query_fingerprint:
               :erlang.term_to_binary({folder.id, folder.private, Map.get(filter, :thread)})
               |> Base.encode64(),
             order: order
           ),
         {:ok, entries} <- page_entries(page_result.entries) do
      page_result
      |> Map.put(:entries, entries)
      |> done()
    end
  end

  defp page_entries(rows) do
    paths = Enum.map(rows, & &1.path)

    with {:ok, lite_rows} <- CMS.articles_lite_paths(paths) do
      rows_by_path =
        Map.new(lite_rows, fn row ->
          {{row.community.slug, row.thread, row.inner_id}, row}
        end)

      {:ok,
       Enum.flat_map(paths, fn path ->
         case Map.get(rows_by_path, {path.community, path.thread, path.inner_id}) do
           nil -> []
           row -> [row]
         end
       end)}
    end
  end
end
