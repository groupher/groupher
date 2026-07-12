defmodule GroupherServer.CMS.DocTree.Write.Operation do
  @moduledoc """
  Wraps one draft tree mutation in lock, revision check, and response payload.

      public Write API
          |
          v
      global lock: doc_tree:<community_id>
          |
          v
      ensure site/tree state + base_revision check
          |
          +--> conflict -> %{conflict: true, affected_nodes: []}
          |
          v
      mutation callback
          |
          v
      bump tree draft revision + build payload

  This module owns the write envelope. It does not decide what a mutation does
  to nodes, events, docs, or trash; it only keeps the concurrency and payload
  contract consistent for every tree write.
  """

  alias GroupherServer.CMS
  alias CMS.Articles.Branch
  alias CMS.DocTree.{Read, Revision}
  alias CMS.Model.{Community, DocsSiteState, DocTreeNode}
  alias Helper.Transaction

  def run(%Community{} = community, args, fun) do
    with {:ok, branch} <- Branch.resolve(community, :doc, args) do
      Transaction.lock_global("doc_tree:#{community.id}:#{branch.id}", fn ->
        with {:ok, _site_state} <- Read.ensure_site_state(community, branch_id: branch.id),
             {:ok, state} <- Read.ensure_draft_state(community, branch_id: branch.id),
             :ok <- revision_check(state, Map.get(args, :base_revision)) do
          fun.(branch, state)
        else
          {:conflict, state} ->
            {:ok,
             %{
               revision: state.tree_lock_version,
               tree_state: Read.tree_state(community, state),
               conflict: true,
               affected_nodes: []
             }}

          error ->
            error
        end
      end)
    end
  end

  def bump_revision(%Community{} = community, %DocsSiteState{} = state, event_count),
    do: Revision.bump_tree_draft(community, state, staged_event_delta: event_count)

  def payload(%Community{} = community, %DocsSiteState{} = state, node, affected \\ []) do
    %{
      revision: state.tree_lock_version,
      tree_state: Read.tree_state(community, state),
      node: map_node(node),
      affected_nodes: Enum.map(affected, &Read.to_map/1),
      conflict: false
    }
  end

  defp revision_check(%DocsSiteState{}, nil),
    do: {:error, {:custom, "base_revision is required"}}

  defp revision_check(%DocsSiteState{} = state, revision)
       when revision == state.tree_lock_version,
       do: :ok

  defp revision_check(%DocsSiteState{} = state, _revision), do: {:conflict, state}

  defp map_node(nil), do: nil
  defp map_node(%DocTreeNode{} = node), do: Read.to_map(node)
end
