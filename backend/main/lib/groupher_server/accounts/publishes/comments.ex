defmodule GroupherServer.Accounts.Publishes.Comments do
  @moduledoc false

  alias GroupherServer.CMS

  def paged_published_comments(user, filter) do
    CMS.Comments.paged_published_comments(user, filter)
  end

  def paged_published_comments(user, thread, filter) do
    CMS.Comments.paged_published_comments(user, thread, filter)
  end
end
