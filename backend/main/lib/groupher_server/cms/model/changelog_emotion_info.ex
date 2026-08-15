defmodule GroupherServer.CMS.Model.ChangelogEmotionInfo do
  @moduledoc """
  Changelog per-emotion projection schema.

  Business position:

      CMS.Interactions.State -> ChangelogEmotionInfo -> cms.changelog_emotion_infos
  """

  use GroupherServer.CMS.Interactions.Schema.EmotionInfoSchema,
    table: "changelog_emotion_infos",
    target: :changelog,
    target_schema: GroupherServer.CMS.Model.Changelog
end
