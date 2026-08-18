defmodule GroupherServer.CMS.Interactions.ViewerState.Article do
  @moduledoc """
  Viewer-facing Interaction state for an Article.

      Interaction State rows
        -> ViewerState.Article
        -> Article response assembler
  """

  defstruct upvotes_count: 0,
            collects_count: 0,
            latest_upvoted_users: [],
            latest_collected_users: [],
            emotions: [],
            viewer_has_upvoted: false,
            viewer_has_collected: false,
            viewer_has_reported: false,
            viewer_has_viewed: false
end
