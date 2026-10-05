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

  alias __MODULE__.{Articles, Comments}
  alias GroupherServer.Accounts

  alias Accounts.Model.User
  alias Helper.T

  @doc "Returns paged articles from the `Publish` read boundary."
  @spec paged_articles(User.t(), T.thread(), map()) :: T.domain_res(T.paged_data())
  def paged_articles(%User{} = user, thread, filter), do: Articles.paged(user, thread, filter)

  def paged_articles(%User{} = user, thread, filter, actor) do
    Articles.paged(user, thread, filter, actor)
  end

  @doc "Updates states through the `Publish` write boundary."
  @spec update_states(User.t(), T.thread()) :: T.domain_res(User.t())
  def update_states(%User{} = user, thread), do: Articles.update_states(user, thread)

  @doc "Returns paged comments from the `Publish` read boundary."
  @spec paged_comments(User.t(), map()) :: T.domain_res(T.paged_data())
  def paged_comments(%User{} = user, filter), do: Comments.paged(user, filter)

  def paged_comments(%User{} = user, filter, actor) when is_map(filter) do
    Comments.paged(user, filter, actor)
  end

  @spec paged_comments(User.t(), T.thread(), map()) :: T.domain_res(T.paged_data())
  def paged_comments(%User{} = user, thread, filter) when is_atom(thread) do
    Comments.paged(user, thread, filter, nil)
  end

  def paged_comments(%User{} = user, thread, filter, actor) do
    Comments.paged(user, thread, filter, actor)
  end
end
