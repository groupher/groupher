defmodule GroupherServer.CMS.Model.DocEmotionInfo do
  @moduledoc """
  Doc per-emotion projection schema.

  Business position:

      CMS.Interactions.State -> DocEmotionInfo -> cms.doc_emotion_infos
  """

  use GroupherServer.CMS.Model.Interaction.EmotionInfo,
    table: "doc_emotion_infos",
    target: :doc,
    target_schema: GroupherServer.CMS.Model.Doc
end
