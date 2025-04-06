defmodule GroupherServer.Accounts.Delegate.Publish do
  @moduledoc """
  user followers / following related
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [plural: 1]

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.{Embeds, User}

  alias Helper.ORM

  @doc """
  get paged published contents of a user
  """
  def paged_published_articles(%User{id: user_id}, thread, filter) do
    CMS.paged_published_articles(thread, filter, user_id)
  end

  @doc """
  update published articles count in user meta
  """
  def update_published_states(%User{} = user, thread) do
    filter = %{page: 1, size: 1}

    with {:ok, paged_articles} <- CMS.paged_published_articles(thread, filter, user.id) do
      ORM.update_meta(user, %{:"published_#{plural(thread)}_count" => paged_articles.total_count})
    end
  end

  def paged_published_comments(user, filter) do
    CMS.paged_published_comments(user, filter)
  end

  def paged_published_comments(user, thread, filter) do
    CMS.paged_published_comments(user, thread, filter)
  end
end
