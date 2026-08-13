defmodule GroupherServer.Accounts.Publish.Comments do
  @moduledoc """
  Account-side read facade for comments a user has published.

  Comment publication remains owned by `CMS.Comments`; this module gives profile
  and mailbox surfaces a compact account namespace for paged reads.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Comments
        -> Repo
  """

  alias GroupherServer.CMS

  def paged(user, filter), do: CMS.Comments.paged_published_comments(user, filter)
  def paged(user, thread, filter), do: CMS.Comments.paged_published_comments(user, thread, filter)
end
