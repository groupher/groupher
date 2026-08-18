defmodule GroupherServer.CMS.Model.DocReactionInfo do
  @moduledoc """
  Doc fixed-reaction projection schema.

  Business position:

      CMS.Interactions.State -> DocReactionInfo -> cms.doc_reaction_infos
  """

  use GroupherServer.CMS.Interactions.Schema.ReactionInfoSchema,
    table: "doc_reaction_infos",
    target: :doc,
    target_schema: GroupherServer.CMS.Model.Doc,
    collection?: true
end
