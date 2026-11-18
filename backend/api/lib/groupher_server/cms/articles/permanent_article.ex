defmodule GroupherServer.CMS.Articles.PermanentArticle do
  @moduledoc """
  Clears Article-scoped restrictive references before the global Article purge.

      admitted global purge -> target-only identity references -> Article row

  Formal site and Docs references must already have passed RetainedHistory's protection check.
  Shared assets are not deleted here; the caller removes only this Article's version refs.
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.CollectFolderEntry
  alias CMS.Model.{Article, ArticleCoAuthor, ArticleCoAuthorRequest}
  alias CMS.Tickets.Model.Source, as: TicketSource

  @doc false
  def prepare_delete(%Article{id: article_id}) do
    if Repo.in_transaction?() do
      Repo.delete_all(from(entry in CollectFolderEntry, where: entry.article_id == ^article_id))

      Repo.delete_all(
        from(request in ArticleCoAuthorRequest, where: request.article_id == ^article_id)
      )

      Repo.delete_all(
        from(co_author in ArticleCoAuthor, where: co_author.article_id == ^article_id)
      )

      Repo.delete_all(
        from(source in TicketSource,
          where: source.post_id == ^article_id or source.ticket_id == ^article_id
        )
      )

      {:ok, :prepared}
    else
      {:error, :transaction_required}
    end
  end
end
