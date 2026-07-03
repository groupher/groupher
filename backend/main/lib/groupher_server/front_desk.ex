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

  def comment(comment_path) when is_map(comment_path), do: CMS.FrontDesk.comment(comment_path)

  def comment(article_path, inner_id), do: CMS.FrontDesk.comment(article_path, inner_id)

  def article(article_path, opts \\ []) when is_map(article_path) and is_list(opts) do
    CMS.FrontDesk.article(article_path, opts)
  end

  def article(community, thread, inner_id) when is_binary(community) do
    preload = [[author: :user], :community]

    CMS.FrontDesk.article(community, thread, inner_id, preload: preload)
  end
end
