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
  alias CMS.Model.{Community, Thread, Comment}
  alias Accounts.Model.User

  def info(:community, slug) when is_binary(slug) do
    with {:ok, community} <- ORM.find_by(Community, %{slug: slug}) do
      ORM.fill_meta(community)
    end
  end

  def info(:thread, thread_id), do: ORM.find(Thread, thread_id)

  def info(:user, id) when is_integer(id) do
    with {:ok, user} <- ORM.find(User, id) do
      ORM.fill_meta(user)
    end
  end

  def info(:user, login) do
    with {:ok, user} <- ORM.find_by(User, %{login: login}) do
      ORM.fill_meta(user)
    end
  end

  def info(:comment, id) do
    with {:ok, comment} <- ORM.find(Comment, id, preload: :author) do
      ORM.fill_meta(comment)
    end
  end

  def info(:article, community, thread, inner_id) when is_binary(community) do
    preload = [[author: :user], :original_community]

    with {:ok, article} <- ORM.find_article(community, thread, inner_id, preload: preload) do
      ORM.fill_meta(article)
    end
  end
end
