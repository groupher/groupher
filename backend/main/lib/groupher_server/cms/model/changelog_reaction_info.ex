defmodule GroupherServer.CMS.Model.ChangelogReactionInfo do
  @moduledoc """
  Changelog fixed-reaction projection schema.

  Business position:

      CMS.Interactions.ReadState -> ChangelogReactionInfo -> cms.changelog_reaction_infos
  """

  use GroupherServer.CMS.Model.Interaction.ReactionInfo,
    table: "changelog_reaction_infos",
    target: :changelog,
    target_schema: GroupherServer.CMS.Model.Changelog,
    collection?: true
end
