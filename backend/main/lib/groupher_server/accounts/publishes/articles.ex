defmodule GroupherServer.Accounts.Publishes.Articles do
  @moduledoc false

  import Helper.Utils, only: [plural: 1]

  alias GroupherServer.Accounts.FrontDesk
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias Helper.ORM

  def paged_published_articles(%User{id: user_id}, thread, filter) do
    with {:ok, user} <- FrontDesk.user(user_id) do
      CMS.Articles.paged_published(thread, filter, user)
    end
  end

  def update_published_states(%User{} = user, thread) do
    filter = %{page: 1, size: 1}

    with {:ok, paged_articles} <- CMS.Articles.paged_published(thread, filter, user) do
      ORM.update_meta(user, %{:"published_#{plural(thread)}_count" => paged_articles.total_count})
    end
  end
end
