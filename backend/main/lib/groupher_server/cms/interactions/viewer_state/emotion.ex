defmodule GroupherServer.CMS.Interactions.ViewerState.Emotion do
  @moduledoc """
  Viewer-facing state for one bounded Interaction emotion.

      EmotionInfo row or empty vocabulary slot
        -> ViewerState.Emotion
        -> Article or Comment ViewerState
  """

  @enforce_keys [:emotion, :count, :latest_users, :viewer_has_reacted]
  defstruct [:emotion, :count, :latest_users, :viewer_has_reacted]

  @type t :: %__MODULE__{
          emotion: atom(),
          count: non_neg_integer(),
          latest_users: [map()],
          viewer_has_reacted: boolean()
        }
end
