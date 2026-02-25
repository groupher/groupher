defmodule GroupherServer.Accounts.Publish do
  @moduledoc """
  Accounts publish facade.
  """

  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  alias __MODULE__.{Articles, Comments}

  @spec paged_articles(User.t(), T.article_thread(), map()) :: T.domain_res(T.paged_data())
  def paged_articles(%User{} = user, thread, filter), do: Articles.paged(user, thread, filter)

  @spec update_states(User.t(), T.article_thread()) :: T.domain_res(User.t())
  def update_states(%User{} = user, thread), do: Articles.update_states(user, thread)

  @spec paged_comments(User.t(), map()) :: T.domain_res(T.paged_data())
  def paged_comments(%User{} = user, filter), do: Comments.paged(user, filter)

  @spec paged_comments(User.t(), T.article_thread(), map()) :: T.domain_res(T.paged_data())
  def paged_comments(%User{} = user, thread, filter), do: Comments.paged(user, thread, filter)
end
