defmodule GroupherServer.CMS.Model.BlogEmotionInfo do
  @moduledoc """
  Blog per-emotion projection schema.

  Business position:

      CMS.Interactions.State -> BlogEmotionInfo -> cms.blog_emotion_infos
  """

  use GroupherServer.CMS.Interactions.Schema.EmotionInfoSchema,
    table: "blog_emotion_infos",
    target: :blog,
    target_schema: GroupherServer.CMS.Model.Blog
end
