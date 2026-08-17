defmodule GroupherServer.Accounts.Publish.Articles do
  @moduledoc """
  Account-side view and counters for a user's published articles.

  The CMS article domain owns publication queries. This module adapts those
  queries for profile pages and keeps the user's published-count meta in sync
  after write paths change article state.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Articles
        -> Repo
  """

  import Helper.Utils, only: [plural: 1]

  alias GroupherServer.{Accounts, CMS}
  alias GroupherServer.FrontDesk, as: RootFrontDesk

  alias Accounts.Model.User
  alias Helper.ORM

  def paged(%User{} = target_user, thread, filter, actor \\ nil) do
    CMS.Articles.paged_published(thread, filter, target_user, actor)
  end

  def update_states(%User{} = user, thread) do
    with {:ok, published_count} <- CMS.Articles.count_published(thread, user) do
      user
      |> ORM.update_meta(%{:"published_#{plural(thread)}_count" => published_count})
      |> revalidate_user(user.login)
    end
  end

  defp revalidate_user({:ok, _result} = response, login) when is_binary(login) do
    RootFrontDesk.revalidate().user(login)
    response
  end

  defp revalidate_user(response, _login), do: response
end
