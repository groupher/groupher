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
    |> Multi.update(
      :tree_state,
      Ecto.Changeset.change(tree_state, %{revision: tree_state.revision + 1})
    )
    |> Multi.update(:updated_site_state, fn %{site_state: site_state} ->
      Ecto.Changeset.change(site_state, %{draft_revision: site_state.draft_revision + 1})
    end)
    |> Repo.transaction()
    |> result()
  end

  defp result({:ok, %{tree_state: tree_state}}), do: {:ok, tree_state}
  defp result({:error, _step, reason, _changes}), do: {:error, reason}
end
