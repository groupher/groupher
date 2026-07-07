defmodule GroupherServer.CMS.DocTree.Write.Trash do
  @moduledoc """
  Moves deleted draft tree nodes into docs trash snapshots.

      delete_node
          |
          v
      subtree_nodes
          |
          +--> doc_tree_trash_items with node snapshot
          +--> optional draft doc + ArticleDocument snapshot
          +--> delete unreferenced draft docs
          +--> delete draft tree rows
          |
          v
      restore/publish can still explain or recover the deletion

  A duplicated page may share one draft doc with another node. This module only
  deletes draft docs that are no longer referenced by any remaining draft page.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.{Events, Read}

  alias CMS.Model.{
    ArticleDocument,
    Community,
    Doc,
    DocTreeNode,
    DocTreeTrashItem
  }

  alias Helper.ORM

  require CMS.Const

  @trash_snapshot_key_draft_doc CMS.Const.doc_tree_trash_snapshot_key(:draft_doc)

  def trash_subtree(%Community{} = community, %DocTreeNode{} = node, actor_id) do
    nodes = subtree_nodes(community, node)

    nodes
    |> Enum.reduce_while({:ok, []}, fn node, {:ok, acc} ->
      attrs = trash_attrs(community, node, actor_id)

      case ORM.create(DocTreeTrashItem, attrs) do
        {:ok, item} -> {:cont, {:ok, [item | acc]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, items} -> {:ok, Enum.reverse(items)}
      error -> error
    end
  end

  def delete_subtree(%Community{} = community, %DocTreeNode{} = node) do
    nodes = subtree_nodes(community, node)

    nodes
    |> Enum.reduce_while(:ok, fn node, :ok ->
      case ORM.delete(node) do
        {:ok, _node} -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  def delete_subtree_doc_drafts(%Community{} = community, %DocTreeNode{} = node) do
    nodes = subtree_nodes(community, node)
    subtree_node_ids = Enum.map(nodes, & &1.node_id)

    doc_ids =
      nodes
      |> subtree_doc_ids()
      |> unreferenced_doc_ids(community, subtree_node_ids)

    case doc_ids do
      [] ->
        :ok

      doc_ids ->
        Doc
        |> where([d], d.community_id == ^community.id)
        |> where([d], d.stage == CMS.Const.stage(:draft))
        |> where([d], d.doc_id in ^doc_ids)
        |> Repo.delete_all()

        Events.discard_doc_bound_staged(community, doc_ids)
        :ok
    end
  end

  def subtree_nodes(%Community{} = community, %DocTreeNode{type: :group} = group) do
    children =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where([n], n.group_id == ^group.node_id)
      |> order_by([n], desc: n.index, desc: n.id)
      |> Repo.all()

    children ++ [group]
  end

  def subtree_nodes(_community, %DocTreeNode{} = node), do: [node]

  defp trash_attrs(%Community{} = community, %DocTreeNode{} = node, actor_id) do
    %{
      community_id: community.id,
      node_id: node.node_id,
      doc_id: node.doc_id,
      node_snapshot: node |> Read.to_map() |> maybe_put_draft_doc_snapshot(community, node),
      deleted_from_group_id: node.group_id,
      deleted_from_index: node.index,
      deleted_at: DateTime.utc_now(:second),
      deleted_by_id: actor_id
    }
  end

  defp maybe_put_draft_doc_snapshot(snapshot, %Community{} = community, %DocTreeNode{
         type: :page,
         doc_id: doc_id
       })
       when not is_nil(doc_id) do
    case draft_doc_snapshot(community, doc_id) do
      nil -> snapshot
      draft_snapshot -> Map.put(snapshot, @trash_snapshot_key_draft_doc, draft_snapshot)
    end
  end

  defp maybe_put_draft_doc_snapshot(snapshot, _community, _node), do: snapshot

  defp draft_doc_snapshot(%Community{} = community, doc_id) do
    with %Doc{} = draft <- draft_doc_by_doc_id(community, doc_id),
         %ArticleDocument{} = document <- draft_article_document(draft) do
      %{
        "doc" => doc_snapshot(draft),
        "document" => article_document_snapshot(document)
      }
    else
      _ -> nil
    end
  end

  defp draft_doc_by_doc_id(%Community{} = community, doc_id) do
    Doc
    |> where([d], d.community_id == ^community.id)
    |> where([d], d.stage == CMS.Const.stage(:draft))
    |> where([d], d.doc_id == ^doc_id)
    |> Repo.one()
  end

  defp draft_article_document(%Doc{} = draft) do
    ArticleDocument
    |> where([d], d.article_id == ^draft.id)
    |> where([d], d.thread == :doc)
    |> Repo.one()
  end

  defp doc_snapshot(%Doc{} = draft) do
    %{
      "docId" => draft.doc_id,
      "title" => draft.title,
      "subtitle" => draft.subtitle,
      "slug" => draft.slug,
      "digest" => draft.digest,
      "json" => draft.json,
      "contentHash" => draft.content_hash,
      "schemaVersion" => draft.schema_version,
      "templateKey" => draft.template_key,
      "authorId" => draft.author_id
    }
  end

  defp article_document_snapshot(%ArticleDocument{} = document) do
    %{
      "title" => document.title,
      "json" => document.json,
      "markdown" => document.markdown,
      "markdownToc" => document.markdown_toc,
      "html" => document.html,
      "xml" => document.xml,
      "rss" => document.rss,
      "plainText" => document.plain_text,
      "digest" => document.digest,
      "contentHash" => document.content_hash,
      "schemaVersion" => document.schema_version
    }
  end

  defp subtree_doc_ids(nodes) do
    nodes
    |> Enum.filter(&(&1.type == :page))
    |> Enum.map(& &1.doc_id)
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
  end

  defp unreferenced_doc_ids([], _community, _subtree_node_ids), do: []

  defp unreferenced_doc_ids(doc_ids, %Community{} = community, subtree_node_ids) do
    referenced_doc_ids =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where([n], n.type == :page)
      |> where([n], n.doc_id in ^doc_ids)
      |> where([n], n.node_id not in ^subtree_node_ids)
      |> select([n], n.doc_id)
      |> Repo.all()
      |> MapSet.new()

    Enum.reject(doc_ids, &MapSet.member?(referenced_doc_ids, &1))
  end
end
