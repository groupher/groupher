defmodule GroupherServer.FrontDesk do
  @moduledoc """
  fetch other model info from cache/DB by given slug/login etc..
  make sure the underline delegates are using model instead of refetch from DB

  those can be use both in function and middleware
  # TODO: bring cache in
  """
  alias GroupherServer.CMS.Model.Community
  alias Helper.ORM
  alias GroupherServer.{CMS, Accounts}
  alias CMS.Model.{Community, Thread}
  alias Accounts.Model.User

  def info(:community, slug) when is_binary(slug) do
    ORM.find_by(Community, %{slug: slug})
  end

  def info(:thread, thread_id), do: ORM.find(Thread, thread_id)
  def info(:user, login), do: ORM.find_by(User, %{login: login})

  def info(:article, community, thread, inner_id) when is_binary(community) do
    preload = [[author: :user], :original_community]
    ORM.find_article(community, thread, inner_id, preload: preload)
  end
end
