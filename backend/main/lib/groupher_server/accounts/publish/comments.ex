defmodule GroupherServer.Accounts.Publish.Comments do
  @moduledoc false

  alias GroupherServer.CMS

  def paged(user, filter), do: CMS.Comments.paged_published_comments(user, filter)
  def paged(user, thread, filter), do: CMS.Comments.paged_published_comments(user, thread, filter)
end
