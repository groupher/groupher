defmodule GroupherServer.Accounts.Publish.Articles do
  @moduledoc false

  import Helper.Utils, only: [plural: 1]

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.FrontDesk
  alias Accounts.Model.User
  alias Helper.ORM

  def paged(%User{id: user_id}, thread, filter) do
    with {:ok, user} <- FrontDesk.user(user_id) do
      CMS.Articles.paged_published(thread, filter, user)
    end
  end

  def update_states(%User{} = user, thread) do
    with {:ok, published_count} <- CMS.Articles.count_published(thread, user) do
      ORM.update_meta(user, %{:"published_#{plural(thread)}_count" => published_count})
    end
  end
end
