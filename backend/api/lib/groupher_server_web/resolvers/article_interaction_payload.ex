defmodule GroupherServerWeb.Resolvers.ArticleInteractionPayload do
  @moduledoc """
  Maps an already-read Interactions private state into its GraphQL payload.

      Interactions viewer state + ArticlePath
        -> ArticleInteractionPayload
        -> owner-specific GraphQL private state

  It is intentionally a pure mapper. Projection reads remain explicit in the
  resolver that assembles the operation payload, and each post-commit reader
  preserves its own authoritative revision.
  """

  @doc """
  Maps an already-read Interaction state into its private GraphQL payload.

  This function performs no Repo or Gate work. The caller must provide the
  admitted Article path and the committed Interaction-owner state; missing
  booleans/revision are normalized to their wire defaults while emotion keeps
  its nullable meaning.
  """
  def from(path, interaction) do
    %{
      community: path.community,
      thread: path.thread,
      inner_id: path.inner_id,
      interaction_revision: interaction.interaction_revision || 0,
      viewer_has_upvoted: interaction.viewer_has_upvoted || false,
      viewer_has_collected: interaction.viewer_has_collected || false,
      viewer_emotion: interaction.viewer_emotion
    }
  end
end
