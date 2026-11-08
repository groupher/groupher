defmodule GroupherServer.CMS.ArtimentMentions.MentionsGraph do
  @moduledoc """
  Owns the public entry point for Mentions graph reads and revision checks.

      GraphQL MentionsGraph resolver
        -> MentionsGraph facade
        -> bounded Query / global revision
  """

  alias GroupherServer.CMS.ArtimentMentions.MentionsGraph.Revision, as: Revision
  alias GroupherServer.CMS.ArtimentMentions.MentionsGraph.Query

  @doc "Returns the current global revision used to validate a graph page."
  def revision, do: Revision.current()

  @doc "Reads a bounded graph page through the MentionsGraph query boundary."
  def page(community, focus, after_cursor, first),
    do: Query.page(community, focus, after_cursor, first)

  @doc "Lists Comment locators with stored outgoing edges for one Article focus."
  def article_comments(community, focus, after_cursor, first) do
    Query.article_comments(community, focus, after_cursor, first)
  end

  @doc "Returns the current graph revision for a valid focus in one Community."
  def revision(community, focus), do: Query.revision(community, focus)
end
