defmodule GroupherServer.CMS.ArtimentMentions.MentionsGraph.Revision do
  @moduledoc """
  Advances the global Mentions graph revision in the caller's transaction.

      graph-visible change -> fixed revision row -> query consistency fence
  """

  import Ecto.Query

  alias GroupherServer.Repo
  alias GroupherServer.CMS.Model.Mentions.GraphState

  @revision_id 1

  @doc "Atomically advances the single global Mentions graph revision."
  def bump do
    if Repo.in_transaction?() do
      case Repo.update_all(
             from(revision in GraphState, where: revision.id == ^@revision_id),
             inc: [revision: 1]
           ) do
        {1, nil} -> {:ok, :pass}
        {0, nil} -> {:error, :mentions_graph_revision_row_missing}
      end
    else
      {:error, :mentions_graph_revision_requires_transaction}
    end
  end

  @doc "Returns the current global revision."
  def current do
    case Repo.get(GraphState, @revision_id) do
      %GraphState{revision: revision} -> {:ok, revision}
      nil -> {:error, :mentions_graph_revision_row_missing}
    end
  end
end
