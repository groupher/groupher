defmodule GroupherServer.FrontDesk do
  @moduledoc """
  fetch other model info from cache/DB by given slug/login etc..
  make sure the underline delegates are using model instead of refetch from DB

  those can be use both in function and middleware
  # TODO: bring cache in
  """
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias Helper.ORM

  def community(slug) when is_binary(slug), do: CMS.FrontDesk.community(slug)

  def thread(thread_id), do: CMS.FrontDesk.thread(thread_id)

  def user(id) when is_integer(id) do
    with {:ok, user} <- ORM.find(User, id) do
      ORM.fill_meta(user)
    end
  end

  def user(login) do
    with {:ok, user} <- ORM.find_by(User, %{login: login}) do
      ORM.fill_meta(user)
    end
  end

  def comment(id), do: CMS.FrontDesk.comment(id)

  def article(community, thread, inner_id) when is_binary(community) do
    preload = [[author: :user], :community]

    CMS.FrontDesk.article(community, thread, inner_id, preload: preload)
  end
end
