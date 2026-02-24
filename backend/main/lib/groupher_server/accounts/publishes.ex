defmodule GroupherServer.Accounts.Publishes do
  @moduledoc false

  alias Helper.Types, as: T

  alias GroupherServer.Accounts.Delegate.Publish
  alias GroupherServer.Accounts.Model.User

  @spec paged_published_articles(User.t(), T.article_thread(), map()) ::
          T.domain_res(T.paged_data())
  def paged_published_articles(user, thread, filter),
    do: Publish.paged_published_articles(user, thread, filter)

  @spec paged_published_comments(User.t(), T.article_thread(), map()) ::
          T.domain_res(T.paged_data())
  def paged_published_comments(user, thread, filter),
    do: Publish.paged_published_comments(user, thread, filter)

  @spec paged_published_comments(User.t(), T.article_thread()) :: T.domain_res(T.paged_data())
  def paged_published_comments(user, thread), do: Publish.paged_published_comments(user, thread)

  @spec update_published_states(User.t(), T.article_thread()) :: T.domain_res(User.t())
  def update_published_states(user, thread), do: Publish.update_published_states(user, thread)
end
