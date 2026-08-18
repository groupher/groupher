defmodule GroupherServer.CMS.Interactions.ViewerState.Comment do
  @moduledoc """
  Viewer-facing Interaction state for a Comment.

      Interaction State rows
        -> ViewerState.Comment
        -> Comment response assembler
  """

  defstruct upvotes_count: 0,
            latest_upvoted_users: [],
            emotions: [],
            viewer_has_upvoted: false,
            viewer_has_reported: false
end
