defmodule GroupherServer.CMS.Model.PostEmotionInfo do
  @moduledoc """
  Post per-emotion projection schema.

  Business position:

      CMS.Interactions.ReadState -> PostEmotionInfo -> cms.post_emotion_infos
  """

  use GroupherServer.CMS.Model.Interaction.EmotionInfo,
    table: "post_emotion_infos"
end
