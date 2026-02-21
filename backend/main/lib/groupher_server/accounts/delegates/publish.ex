defmodule GroupherServer.Accounts.Delegate.Publish do
  @moduledoc """
  user followers / following related
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [plural: 1]

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User

  alias Helper.ORM

  @doc """
  get paged published contents of a user
  """
  def paged_published_articles(%User{id: user_id}, thread, filter) do
    with {:ok, user} <- ORM.find(User, user_id) do
      CMS.Articles.paged_published(thread, filter, user)
    end
  end

  @doc """
  update published articles count in user meta
  """
  def update_published_states(%User{} = user, thread) do
    filter = %{page: 1, size: 1}

    with {:ok, paged_articles} <- CMS.Articles.paged_published(thread, filter, user) do
      ORM.update_meta(user, %{:"published_#{plural(thread)}_count" => paged_articles.total_count})
    end
  end

  def paged_published_comments(user, filter) do
    CMS.Comments.paged_published_comments(user, filter)
  end

  def paged_published_comments(user, thread, filter) do
    CMS.Comments.paged_published_comments(user, thread, filter)
  end
end
