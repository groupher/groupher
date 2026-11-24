defmodule GroupherServer.CMS.Communities.Subscriptions.Query do
  @moduledoc """
  Read-only subscription membership queries.

      Query -> Persist read primitive -> subscription membership fact
  """

  alias GroupherServer.{Accounts, CMS}

  alias CMS.Model.Community
  alias Accounts.Model.User
  alias CMS.Communities.Subscriptions.Persist

  @doc "Reports whether the persistence layer contains this user's Community subscription."
  @spec subscribed?(Community.t(), User.t()) :: boolean()
  def subscribed?(%Community{} = community, %User{} = user) do
    Persist.subscribed?(community, user)
  end
end
