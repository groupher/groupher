defmodule GroupherServer.CMS.Communities.Visibility do
  @moduledoc """
  Compatibility delegates for the former Community visibility policy.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> Visibility
        -> Repo / Oban
  """

  alias GroupherServer.CMS.Communities.Read
  alias GroupherServer.CMS.Model.Community

  @doc "Restricts a Community query to publicly visible rows."
  @spec public_query(Ecto.Queryable.t()) :: Ecto.Query.t()
  def public_query(queryable \\ Community), do: Read.scope(queryable)

  @doc "Checks a preloaded Community against the same public policy."
  @spec public?(Community.t()) :: boolean()
  def public?(%Community{} = community), do: Read.public?(community)
end
