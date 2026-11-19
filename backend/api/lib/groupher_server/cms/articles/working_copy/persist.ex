defmodule GroupherServer.CMS.Articles.WorkingCopy.Persist do
  @moduledoc """
  Owns persistence operations used by WorkingCopy history capabilities.

      WorkingCopy.History
        -> Persist delegation
        -> ArticleHistory transaction-bound insert
        -> caller transaction commits or rolls back
  """

  alias GroupherServer.CMS
  alias CMS.Articles.WorkingCopy.Persist.ArticleHistory

  defdelegate append_article_event_in_transaction(article_id, attrs),
    to: ArticleHistory

  @doc "Requires the caller-owned transaction before freezing Article history."
  defdelegate require_transaction(), to: ArticleHistory
end
