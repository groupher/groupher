defmodule GroupherServer.CMS.Model.CommentEmotionInfo do
  @moduledoc """
  Comment per-emotion projection schema.

  Business position:

      CMS.Interactions.State -> CommentEmotionInfo -> cms.comment_emotion_infos
  """

  use GroupherServer.CMS.Model.Interaction.EmotionInfo,
    table: "comment_emotion_infos",
    target: :comment,
    target_schema: GroupherServer.CMS.Model.Comment
end
