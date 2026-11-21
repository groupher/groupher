defmodule GroupherServer.CMS.DocTree.WorkspaceTrashRead do
  @moduledoc """
  Lists recoverable branch-free Docs Trash actions for a site.

      Docs Trash query -> Gate / WorkspaceTrashRead -> recoverable Trash actions
  """
  import Ecto.Query
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Publish.SiteLock
  alias CMS.Model.{Community, DocsTrashedTreeNode, TrashAction}
  alias Helper.ORM

  @doc "Pages root Trash actions after site management admission."
  def list(%Community{} = community, pagi, %User{} = actor) do
    Repo.transact(fn ->
      with {:ok, community} <- CMS.Gate.Access.Check.community(actor, :docs_trash_read, community),
           {:ok, :acquired} <- SiteLock.acquire(community),
           query <-
             from(a in TrashAction,
               where: a.community_id == ^community.id and a.root_type == "doc_tree_node"
             ),
           {:ok, page} <-
             ORM.pagi(query, pagi,
               for: TrashAction,
               surface: "docs.tree_trash",
               query_fingerprint: "docs-site:#{community.id}",
               order: %Helper.ORM.Pagi.Order{
                 fields: [:deleted_at, :id],
                 directions: [:desc, :desc],
                 cursor_fields: [:deleted_at, :id]
               }
             ),
           {:ok, entries} <- entries(page.entries) do
        {:ok, %{page | entries: entries}}
      end
    end)
  end

  def list(_, _, _), do: {:error, :invalid_docs_workspace_reader}

  defp entries(actions) do
    ids = Enum.map(actions, & &1.id)
    root_ids = Enum.map(actions, & &1.root_ref)

    roots =
      Repo.all(
        from(n in DocsTrashedTreeNode,
          where: n.trash_action_id in ^ids and n.node_id in ^root_ids
        )
      )

    by_identity = Map.new(roots, &{{&1.trash_action_id, &1.node_id}, &1})

    Enum.reduce_while(actions, {:ok, []}, fn action, {:ok, acc} ->
      case by_identity[{action.id, action.root_ref}] do
        %DocsTrashedTreeNode{} = root ->
          snapshot = root.draft_snapshot || root.public_snapshot || root.queue_snapshot

          item = %{
            id: action.hash_id,
            node_id: root.node_id,
            doc_id: root.doc_id,
            type: Atom.to_string(root.type),
            title: snapshot["title"],
            deleted_from_parent_node_id: snapshot["parent_node_id"],
            deleted_from_index: snapshot["index"],
            deleted_at: action.deleted_at,
            restored_at: nil
          }

          {:cont, {:ok, [item | acc]}}

        nil ->
          {:halt, {:error, :invalid_trash_action}}
      end
    end)
    |> case do
      {:ok, result} -> {:ok, Enum.reverse(result)}
      error -> error
    end
  end
end
