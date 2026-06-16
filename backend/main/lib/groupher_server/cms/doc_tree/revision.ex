defmodule GroupherServer.CMS.DocTree.Revision do
  @moduledoc """
  Revision bookkeeping for docs draft mutations.

  Two counters move together:

      doc_tree_draft_states.revision
          - narrow counter returned to the editor for conflict detection

      docs_site_states.draft_revision
          - site-level counter used to compare with last_published_draft_revision

      has_unpublished_changes =
        draft_revision != last_published_draft_revision

  They are updated through one `Ecto.Multi` so callers do not accidentally bump
  the tree revision without bumping the site draft revision.
  """

  alias Ecto.Multi
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocsSiteState, DocTreeDraftState}
  alias Helper.{ORM, T}

  @spec bump_draft(Community.t(), DocTreeDraftState.t()) :: T.domain_res(DocTreeDraftState.t())
  def bump_draft(%Community{} = community, %DocTreeDraftState{} = tree_state) do
    Multi.new()
    |> Multi.run(:site_state, fn _, _ ->
      ORM.find_by(DocsSiteState, community_id: community.id)
    end)
    |> Multi.run(:tree_state, fn _, _ ->
      ORM.inc(tree_state, :revision)
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
