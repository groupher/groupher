defmodule GroupherServer.CMS.Communities.Subscribers do
  @moduledoc """
  Internal facade for Community subscriber queries.

      caller -> GroupherServer.CMS.Communities.Subscribers -> result
  """

  alias __MODULE__.Query

  @doc "Pages Community subscribers using the standard pagination contract."
  defdelegate page(community, filter, pagi), to: Query
  @doc "Pages Community subscribers with an optional viewer context."
  defdelegate page(community, filter, pagi, viewer), to: Query
end
