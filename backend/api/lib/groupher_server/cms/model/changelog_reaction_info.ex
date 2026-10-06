defmodule GroupherServer.CMS.Model.ChangelogReactionInfo do
  @moduledoc """
  Changelog fixed-reaction projection schema.

  Business position:

      CMS.Interactions.ReadState -> ChangelogReactionInfo -> cms.changelog_reaction_infos
  """

  use GroupherServer.CMS.Model.Interaction.ReactionInfo,
    table: "changelog_reaction_infos",
    collection?: true
end
