defmodule GroupherServer.FrontDesk do
  @moduledoc """
  fetch other model info from cache/DB by given slug/login etc..
  make sure the underline delegates are using model instead of refetch from DB

  those can be use both in function and middleware
  # TODO: bring cache in
  """
  alias GroupherServer.{Accounts, CMS}

  def community(slug) when is_binary(slug), do: CMS.FrontDesk.community(slug)

  def user(id) when is_integer(id) do
    Accounts.FrontDesk.user(id)
  end

  def user(login) do
    Accounts.FrontDesk.user(login)
  end

  def comment(id), do: CMS.FrontDesk.comment(id)

  def article(community, thread, inner_id) when is_binary(community) do
    preload = [[author: :user], :community]

    CMS.FrontDesk.article(community, thread, inner_id, preload: preload)
  end
end
