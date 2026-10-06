defmodule GroupherServer.CMS.Model.PostReactionInfo do
  @moduledoc """
  Post fixed-reaction projection schema.

  Business position:

      CMS.Interactions.ReadState -> PostReactionInfo -> cms.post_reaction_infos
  """

  use GroupherServer.CMS.Model.Interaction.ReactionInfo,
    table: "post_reaction_infos",
    collection?: true
end
