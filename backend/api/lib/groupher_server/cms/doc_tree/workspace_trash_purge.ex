defmodule GroupherServer.CMS.DocTree.WorkspaceTrashPurge do
  @moduledoc """
  Removes one inactive Docs Trash aggregate while retaining immutable history.

    The caller holds the site lock and owns authorization, Receipt and rollback.
    Public heads, working-tree nodes and active Queue references block the purge.

      PurgeWorkspaceTrash command -> WorkspaceTrashPurge -> lifecycle / working copy / Trash
  """
  import Ecto.Query
  alias GroupherServer.{Accounts, AlertWall, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.WorkingCopy.Deleter
  alias CMS.DocTree.Publish.Queue

  alias CMS.Model.{
    Article,
    ArticleLifecycle,
    ArticlePublic,
    ArticleWorkingCopy,
    Community,
    DocsPostPublishConflict
  }

  alias CMS.Model.{
    DocsPublishQueue,
    DocsQueueArticle,
    DocsQueueTreeChange,
    DocsTreeNode,
    DocsTrashedArticle,
    DocsTrashedTreeNode,
    TrashAction
  }

  @doc "Permanently clears one unreferenced Trash action within the caller transaction."
  def run(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        queue_revision,
        action_id,
        actor,
        command_id
      )
      when (is_struct(actor, User) or actor == :operations) and
             is_integer(queue_revision) and queue_revision >= 0 and is_binary(action_id) and
             is_binary(command_id) do
    with {:ok, action_id} <- Ecto.UUID.cast(action_id),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: queue_revision}, []),
         %TrashAction{} = action <-
           Repo.one(
             from(a in TrashAction,
               where:
                 a.hash_id == ^action_id and a.community_id == ^community.id and
                   a.root_type == "doc_tree_node",
               lock: "FOR UPDATE"
             )
           ),
         nodes <-
           Repo.all(
             from(n in DocsTrashedTreeNode,
               where: n.trash_action_id == ^action.id and n.community_id == ^community.id,
               order_by: n.node_id,
               lock: "FOR UPDATE"
             )
           ),
         docs <-
           Repo.all(
             from(d in DocsTrashedArticle,
               where: d.trash_action_id == ^action.id and d.community_id == ^community.id,
               order_by: d.article_id,
               lock: "FOR UPDATE"
             )
           ),
         true <- nodes != [],
         {:ok, articles} <- authorize(community, docs, actor),
         {:ok, :pass} <- unreferenced(community, queue, action, nodes, docs),
         {:ok, :pass} <- purge_documents(community, docs, articles, command_id),
         {:ok, :pass} <- remove_trash(action, nodes, docs) do
      {:ok, %{trash_action_id: action.hash_id}}
    else
      :error -> {:error, :invalid_trash_action}
      nil -> {:error, :trash_action_not_found}
      false -> {:error, :invalid_trash_action}
      {:error, _} = error -> error
    end
  end

  def run(_, _, _, _, _, _), do: {:error, :invalid_tree_input}

  defp authorize(community, docs, actor) do
    ids = Enum.map(docs, & &1.article_id)

    articles =
      Repo.all(from(a in Article, where: a.id in ^ids, order_by: a.id, lock: "FOR UPDATE"))

    if length(articles) != length(ids) do
      {:error, :invalid_doc_identity}
    else
      Enum.reduce_while(articles, {:ok, %{}}, fn article, {:ok, acc} ->
        case CMS.Gate.Access.Check.with_authorized_article_binding(
               actor,
               :permanently_delete,
               {community, article},
               fn _ -> {:ok, :pass} end
             ) do
          {:ok, :pass} -> {:cont, {:ok, Map.put(acc, article.id, article)}}
          {:error, _} = error -> {:halt, error}
        end
      end)
    end
  end

  defp unreferenced(community, queue, action, nodes, docs) do
    node_ids = Enum.map(nodes, & &1.node_id)
    doc_ids = Enum.map(docs, & &1.article_id)

    referenced =
      Repo.exists?(
        from(n in DocsTreeNode,
          where:
            n.community_id == ^community.id and (n.node_id in ^node_ids or n.doc_id in ^doc_ids)
        )
      ) or
        Repo.exists?(
          from(n in DocsTrashedTreeNode,
            where:
              n.community_id == ^community.id and n.trash_action_id != ^action.id and
                (n.node_id in ^node_ids or n.doc_id in ^doc_ids)
          )
        ) or
        Repo.exists?(from(p in ArticlePublic, where: p.article_id in ^doc_ids)) or
        Repo.exists?(
          from(m in DocsQueueArticle, where: m.queue_id == ^queue.id and m.article_id in ^doc_ids)
        ) or
        Repo.exists?(
          from(c in DocsQueueTreeChange,
            where:
              c.queue_id == ^queue.id and
                (c.node_id in ^node_ids or fragment("?->>'doc_id'", c.target) in ^doc_ids)
          )
        )

    if referenced, do: {:error, :docs_trash_in_use}, else: {:ok, :pass}
  end

  defp purge_documents(community, docs, articles, command_id) do
    Enum.reduce_while(docs, {:ok, :pass}, fn doc, _ ->
      case purge_document(community, doc, articles[doc.article_id], command_id) do
        {:ok, :pass} -> {:cont, {:ok, :pass}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp purge_document(community, _doc, %Article{thread: :doc} = article, command_id) do
    with %ArticleLifecycle{} = _lifecycle <-
           Repo.one(
             from(l in ArticleLifecycle,
               where: l.article_id == ^article.id,
               lock: "FOR UPDATE"
             )
           ),
         {:ok, work} <- load_optional_default(article),
         {:ok, :pass} <- CMS.ArtimentMentions.mark_deleted(%{type: :doc, article_id: article.id}),
         {:ok, :pass} <-
           CMS.Review.Requests.mark_content_changed_in_transaction(%{
             type: :article,
             article_id: article.id
           }),
         {:ok, :pass} <-
           AlertWall.mark_target_deleted_in_transaction(:article, article.id, command_id),
         {_count, _} <-
           Repo.delete_all(
             from(c in DocsPostPublishConflict,
               where: c.community_id == ^community.id and c.article_id == ^article.id
             )
           ),
         {:ok, :deleted} <- delete_optional_default(article, work),
         {_count, _} <-
           Repo.delete_all(
             from(b in CMS.Model.ArticleBinding,
               where: b.article_id == ^article.id and b.community_id == ^community.id
             )
           ) do
      {:ok, :pass}
    else
      nil -> {:error, :invalid_doc_lifecycle}
      {:error, _} = error -> error
    end
  end

  defp purge_document(_, _, _, _), do: {:error, :invalid_doc_identity}

  defp load_optional_default(article) do
    case Repo.one(
           from(w in ArticleWorkingCopy,
             where:
               w.article_id == ^article.id and w.scope_type == :default and
                 w.scope_id == ^article.id,
             lock: "FOR UPDATE"
           )
         ) do
      %ArticleWorkingCopy{} = work -> {:ok, work}
      nil -> {:ok, nil}
    end
  end

  defp delete_optional_default(_article, nil), do: {:ok, :deleted}

  defp delete_optional_default(article, work) do
    Deleter.delete_docs_aggregate_in_transaction(article, work)
  end

  defp remove_trash(action, nodes, docs) do
    {node_count, _} =
      Repo.delete_all(from(n in DocsTrashedTreeNode, where: n.trash_action_id == ^action.id))

    {doc_count, _} =
      Repo.delete_all(from(d in DocsTrashedArticle, where: d.trash_action_id == ^action.id))

    if node_count == length(nodes) and doc_count == length(docs) do
      with {:ok, _} <- Repo.delete(action), do: {:ok, :pass}
    else
      {:error, :trash_action_changed}
    end
  end
end
