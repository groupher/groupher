defmodule GroupherServer.CMS.Articles.WorkingCopy.Persist do
  @moduledoc """
  Owns persistence operations used by WorkingCopy history capabilities.
  """

  alias GroupherServer.CMS.Articles.WorkingCopy.Persist.ArticleHistory

  defdelegate append_article_event_in_transaction(article_id, attrs),
    to: ArticleHistory
end
