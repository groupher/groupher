defmodule GroupherServer.CMS.Articles.PermanentArticle do
  @moduledoc """
  Clears Article-scoped restrictive references before the global Article purge.

      admitted global purge -> target-only identity references -> Article row

  Formal site and Docs references must already have passed RetainedHistory's protection check.
  Shared assets are not deleted here; the caller removes only this Article's version refs.
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.{CollectFolder, CollectFolderEntry}
  alias CMS.Model.{Article, ArticleBinding, ArticleCoAuthor, ArticleCoAuthorRequest}
  alias CMS.Tickets.Model.Source

  @doc false
  def prepare_delete(%Article{id: article_id}) do
    if Repo.in_transaction?() do
      with {:ok, :pass} <- remove_collect_folder_entries(article_id) do
        Repo.delete_all(
          from(request in ArticleCoAuthorRequest, where: request.article_id == ^article_id)
        )

        Repo.delete_all(
          from(co_author in ArticleCoAuthor, where: co_author.article_id == ^article_id)
        )

        Repo.delete_all(
          from(source in Source,
            where: source.post_id == ^article_id or source.ticket_id == ^article_id
          )
        )

        {:ok, :prepared}
      end
    else
      {:error, :transaction_required}
    end
  end

  defp remove_collect_folder_entries(article_id) do
    entries =
      Repo.all(
        from(entry in CollectFolderEntry,
          join: folder in CollectFolder,
          on: folder.id == entry.folder_id,
          join: binding in ArticleBinding,
          on: binding.id == entry.article_binding_id,
          where: entry.article_id == ^article_id,
          select: {folder, binding}
        )
      )

    Enum.reduce_while(entries, {:ok, :pass}, fn {folder, binding}, _acc ->
      case Accounts.collect_folders_remove_in_transaction(
             folder,
             binding.thread,
             binding,
             folder.user_id
           ) do
        {:ok, _result} -> {:cont, {:ok, :pass}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
  end
end
