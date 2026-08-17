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

  def paged(user, filter, actor \\ nil),
    do: CMS.Comments.paged_published_comments(user, filter, actor)

  def paged(user, thread, filter, actor),
    do: CMS.Comments.paged_published_comments(user, thread, filter, actor)
end
