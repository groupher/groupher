defmodule GroupherServer.CMS.Model.BlogEmotionInfo do
  @moduledoc """
  Blog per-emotion projection schema.

  Business position:

      CMS.Interactions.ReadState -> BlogEmotionInfo -> cms.blog_emotion_infos
  """

  use GroupherServer.CMS.Model.Interaction.EmotionInfo,
    table: "blog_emotion_infos",
    target: :blog,
    target_schema: GroupherServer.CMS.Model.Blog
end
