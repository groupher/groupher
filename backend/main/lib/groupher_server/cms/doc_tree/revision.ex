defmodule GroupherServer.CMS.DocTree.Revision do
  @moduledoc """
  Revision bookkeeping for docs draft mutations.

  Tree writes and doc-content writes intentionally have different counters:

      doc_tree_draft_states.revision
          - narrow counter returned to the editor for conflict detection

      doc_tree_draft_states.staged_event_count
          - count of staged Tree domain events since the latest Tree publish

      docs_site_states.draft_revision
          - site-level counter used to compare with last_published_draft_revision

  Tree mutations bump all three. Doc content mutations only bump the site draft
  revision through `bump_site_draft/1`.
  """

  alias Ecto.Multi
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocsSiteState, DocTreeDraftState}
  alias Helper.{ORM, T}

  @spec bump_draft(Community.t(), DocTreeDraftState.t(), keyword()) ::
          T.domain_res(DocTreeDraftState.t())
  def bump_draft(%Community{} = community, %DocTreeDraftState{} = tree_state, opts \\ []) do
    staged_event_delta = Keyword.get(opts, :staged_event_delta, 0)

    Multi.new()
    |> Multi.run(:site_state, fn _, _ ->
      ORM.find_by(DocsSiteState, community_id: community.id)
    end)
    |> Multi.run(:tree_state, fn _, _ ->
      tree_state
      |> Ecto.Changeset.change(%{
        revision: tree_state.revision + 1,
        staged_event_count: tree_state.staged_event_count + staged_event_delta
      })
      |> Repo.update()
    end)
    |> Multi.run(:updated_site_state, fn _, %{site_state: site_state} ->
      ORM.inc(site_state, :draft_revision)
    end)
    |> Repo.transaction()
    |> result()
  end

  @spec bump_site_draft(Community.t()) :: T.domain_res(DocsSiteState.t())
  def bump_site_draft(%Community{} = community) do
    Multi.new()
    |> Multi.run(:site_state, fn _, _ ->
      ORM.find_by(DocsSiteState, community_id: community.id)
    end)
    |> Multi.run(:updated_site_state, fn _, %{site_state: site_state} ->
      ORM.inc(site_state, :draft_revision)
    end)
    |> Repo.transaction()
    |> site_result()
  end

  defp result({:ok, %{tree_state: tree_state}}), do: {:ok, tree_state}
  defp result({:error, _step, reason, _changes}), do: {:error, reason}

  defp site_result({:ok, %{updated_site_state: site_state}}), do: {:ok, site_state}
  defp site_result({:error, _step, reason, _changes}), do: {:error, reason}
end
