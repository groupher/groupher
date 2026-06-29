defmodule GroupherServer.CMS.DocTree.Revision do
  @moduledoc """
  Revision bookkeeping for docs draft mutations.

  Tree writes and doc-content writes intentionally share one state row but keep
  different counters:

      docs_site_states.tree_lock_version
          - narrow counter returned to the editor for tree conflict detection

      docs_site_states.staged_event_count
          - count of staged Tree domain events since the latest Tree publish

      docs_site_states.site_draft_version
          - site-level counter used to compare with published_version

  Tree mutations bump the tree lock and site draft version. Doc content
  mutations only bump the site draft version through `bump_site_draft/1`.
  """

  alias Ecto.Multi
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocsSiteState}
  alias Helper.{ORM, T}

  @spec bump_tree_draft(Community.t(), DocsSiteState.t(), keyword()) ::
          T.domain_res(DocsSiteState.t())
  def bump_tree_draft(%Community{} = community, %DocsSiteState{} = state, opts \\ []) do
    staged_event_delta = Keyword.get(opts, :staged_event_delta, 0)

    Multi.new()
    |> Multi.run(:site_state, fn _, _ ->
      ensure_current_state(community, state)
    end)
    |> Multi.run(:updated_site_state, fn _, %{site_state: state} ->
      state
      |> Ecto.Changeset.change(%{
        tree_lock_version: state.tree_lock_version + 1,
        site_draft_version: state.site_draft_version + 1,
        staged_event_count: state.staged_event_count + staged_event_delta
      })
      |> Repo.update()
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
      ORM.inc(site_state, :site_draft_version)
    end)
    |> Repo.transaction()
    |> result()
  end

  defp ensure_current_state(%Community{} = community, %DocsSiteState{} = state) do
    ORM.find_by(DocsSiteState, id: state.id, community_id: community.id)
  end

  defp result({:ok, %{updated_site_state: state}}), do: {:ok, state}
  defp result({:error, _step, reason, _changes}), do: {:error, reason}
end
