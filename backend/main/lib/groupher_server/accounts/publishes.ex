defmodule GroupherServer.Accounts.Publishes do
  @moduledoc """
  Accounts publishes facade.
  """

  alias GroupherServer.Accounts.Model.User
  alias Helper.Types, as: T

  alias __MODULE__.{Articles, Comments}

  @spec paged_published_articles(User.t(), T.article_thread(), map()) :: T.domain_res(T.paged_data())
  def paged_published_articles(%User{} = user, thread, filter) do
    Articles.paged_published_articles(user, thread, filter)
  end

  @spec update_published_states(User.t(), T.article_thread()) :: T.domain_res(User.t())
  def update_published_states(%User{} = user, thread) do
    Articles.update_published_states(user, thread)
  end

  @spec paged_published_comments(User.t(), map()) :: T.domain_res(T.paged_data())
  def paged_published_comments(%User{} = user, filter), do: Comments.paged_published_comments(user, filter)

  @spec paged_published_comments(User.t(), T.article_thread(), map()) :: T.domain_res(T.paged_data())
  def paged_published_comments(%User{} = user, thread, filter) do
    Comments.paged_published_comments(user, thread, filter)
  end
end
