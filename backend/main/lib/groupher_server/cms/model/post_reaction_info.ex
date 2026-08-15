defmodule GroupherServer.CMS.Model.PostReactionInfo do
  @moduledoc """
  Post fixed-reaction projection schema.

  Business position:

      CMS.Interactions.State -> PostReactionInfo -> cms.post_reaction_infos
  """

  use GroupherServer.CMS.Interactions.Schema.ReactionInfoSchema,
    table: "post_reaction_infos",
    target: :post,
    target_schema: GroupherServer.CMS.Model.Post,
    collection?: true
end
