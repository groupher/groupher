defmodule GroupherServer.Accounts.Publish do
  @moduledoc """
  Account-facing read model for a user's published artiments and comments.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Publish
        -> Repo
  """

  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  alias __MODULE__.{Articles, Comments}

  @spec paged_articles(User.t(), T.thread(), map()) :: T.domain_res(T.paged_data())
  @doc "Returns paged articles from the `Publish` read boundary."
  def paged_articles(%User{} = user, thread, filter), do: Articles.paged(user, thread, filter)

  @spec update_states(User.t(), T.thread()) :: T.domain_res(User.t())
  @doc "Updates states through the `Publish` write boundary."
  def update_states(%User{} = user, thread), do: Articles.update_states(user, thread)

  @spec paged_comments(User.t(), map()) :: T.domain_res(T.paged_data())
  @doc "Returns paged comments from the `Publish` read boundary."
  def paged_comments(%User{} = user, filter), do: Comments.paged(user, filter)

  @spec paged_comments(User.t(), T.thread(), map()) :: T.domain_res(T.paged_data())
  def paged_comments(%User{} = user, thread, filter), do: Comments.paged(user, thread, filter)
end
