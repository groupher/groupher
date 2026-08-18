defmodule GroupherServer.CMS.Model.CommentReactionInfo do
  @moduledoc """
  Comment fixed-reaction projection schema.

  Business position:

      CMS.Interactions.State -> CommentReactionInfo -> cms.comment_reaction_infos
  """

  use GroupherServer.CMS.Model.Interaction.ReactionInfo,
    table: "comment_reaction_infos",
    target: :comment,
    target_schema: GroupherServer.CMS.Model.Comment,
    collection?: false
end
