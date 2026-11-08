defmodule GroupherServer.CMS.ArtimentMentions do
  @moduledoc """
  Public facade for current CMS artiment mention relationships.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> ArtimentMentions
        -> Repo / external boundary
  """

  alias __MODULE__.{Commands.Update, Persist}

  @doc "Updates one selected body's graph inside its owning Command transaction."
  defdelegate update(source, body, identity),
    to: Update,
    as: :execute

  @doc "Keeps a restricted source's edges and invalidates graph cursors in its owner's transaction."
  defdelegate hide_source(source_identity), to: Persist, as: :hide_outgoing_mentions

  @doc "Marks an endpoint deleted inside the source owner's transaction."
  defdelegate mark_deleted(source_identity), to: Persist
end
