defmodule GroupherServer.CMS.Communities.Subscriptions do
  @moduledoc """
  Internal facade for Community subscription state.

      caller -> GroupherServer.CMS.Communities.Subscriptions -> result
  """

  alias __MODULE__.{Query, Setup}

  @doc "Checks whether a user is subscribed to the Community."
  defdelegate subscribed?(community, user), to: Query
  @doc "Subscribes a user through the internal Community setup operation."
  defdelegate setup_subscribe(community, user), to: Setup, as: :subscribe
  @doc "Unsubscribes a user through the internal Community setup operation."
  defdelegate setup_unsubscribe(community, user), to: Setup, as: :unsubscribe
end
