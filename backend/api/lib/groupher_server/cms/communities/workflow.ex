defmodule GroupherServer.CMS.Communities.Workflow do
  @moduledoc """
  Coordinates Community operations that combine public read options with writes.

      Communities facade -> Workflow -> Persist
  """

  alias GroupherServer.CMS

  alias CMS.Communities.Persist
  alias CMS.ArtimentMentions.MentionsGraph.Revision
  alias CMS.Dashboard.Effects
  alias CMS.Model.Community

  @doc "Increments the Community view count only when the read options request it."
  @spec maybe_increment_views(Community.t(), keyword()) ::
          {:ok, Community.t()} | {:error, term()}
  def maybe_increment_views(%Community{} = community, opts) when is_list(opts) do
    case Keyword.get(opts, :inc_views) do
      true -> Persist.increment_views(community)
      false -> {:ok, community}
      nil -> {:ok, community}
    end
  end

  @doc "Updates a contribution projection inside its owner's transaction."
  def update_contribution_digest(%Community{} = community, digest, operation_ref) do
    with {:ok, canonical} <-
           CMS.Gate.check_community_workflow_in_transaction(:operations, :update, community),
         {:ok, updated} <- Persist.update_fields(canonical, %{contributes_digest: digest}),
         {:ok, :pass} <- Revision.bump(),
         {:ok, _event} <- Effects.enqueue_presentation_changed(updated, operation_ref) do
      {:ok, updated}
    end
  rescue
    reason in [Postgrex.Error, DBConnection.ConnectionError] ->
      {:error, CMS.CommandPipelineAdapter.normalize_transaction_error(reason)}
  end
end
