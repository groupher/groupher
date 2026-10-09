defmodule GroupherServer.CMS.Communities.Subscriptions.Query do
  @moduledoc """
  Read-only subscription membership queries.

      Query -> Persist read primitive -> subscription membership fact
  """

  alias GroupherServer.CMS.Model.Community
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Communities.Subscriptions.Persist

  @spec subscribed?(Community.t(), User.t()) :: boolean()
  def subscribed?(%Community{} = community, %User{} = user),
    do: Persist.subscribed?(community, user)
end
