defmodule GroupherServer.CMS.Model.BlogReactionInfo do
  @moduledoc """
  Blog fixed-reaction projection schema.

  Business position:

      CMS.Interactions.State -> BlogReactionInfo -> cms.blog_reaction_infos
  """

  use GroupherServer.CMS.Model.Interaction.ReactionInfo,
    table: "blog_reaction_infos",
    target: :blog,
    target_schema: GroupherServer.CMS.Model.Blog,
    collection?: true
end
