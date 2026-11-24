defmodule GroupherServer.CMS.Communities.Moderators do
  @moduledoc """
  Internal facade for Community moderator membership.

      caller -> GroupherServer.CMS.Communities.Moderators -> result
  """

  alias __MODULE__.{Query, Setup}

  defdelegate add_root(community, owner), to: Setup
  defdelegate page(community, filter, pagi), to: Query
  defdelegate page(community, filter, pagi, viewer), to: Query
end
