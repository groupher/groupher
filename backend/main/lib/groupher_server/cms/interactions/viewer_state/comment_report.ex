defmodule GroupherServer.CMS.Interactions.ViewerState.CommentReport do
  @moduledoc """
  Report-surface Interaction state for a Comment.

      Interaction report projection
        -> ViewerState.CommentReport
        -> authorized report response assembler
  """

  defstruct upvotes_count: 0,
            latest_upvoted_users: [],
            emotions: [],
            viewer_has_upvoted: false,
            viewer_has_reported: false,
            reported_count: 0
end
