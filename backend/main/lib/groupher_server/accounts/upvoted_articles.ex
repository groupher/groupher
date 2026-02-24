defmodule GroupherServer.Accounts.UpvotedArticles do
  @moduledoc false

  alias Helper.Types, as: T

  alias GroupherServer.Accounts.Delegate.UpvotedArticles

  @spec paged_upvoted_articles(T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_upvoted_articles(user_id, filter),
    do: UpvotedArticles.paged_upvoted_articles(user_id, filter)
end
