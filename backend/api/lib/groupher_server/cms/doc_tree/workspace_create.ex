defmodule GroupherServer.CMS.DocTree.WorkspaceCreate do
  @moduledoc """
  Creates a working directory node and, for a Page, its default Article copy.

    The caller owns authorization, the transaction, Receipt and rollback.

      CreateWorkspaceNode command -> WorkspaceCreate -> node and Article working copy
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.DocTree.Publish.{Queue, TreeOrder}
  alias CMS.DocTree.WorkspacePersist
  alias CMS.Model.{Community, DocsPublishQueue}

  @fields ~w(node_id type parent_node_id index title href doc_id marker badge hidden)a

  @doc "Creates one validated draft node under the checked site tree version."
  def run(%Community{} = community, %DocsPublishQueue{} = queue, revision, attrs, %User{} = actor)
      when is_integer(revision) and revision >= 0 and is_map(attrs) do
    with {:ok, queue} <- Queue.advance(community, queue, %{tree_lock_version: revision}, []),
         {:ok, input} <- normalize(attrs),
         {:ok, content} <- create_content(community, input, actor),
         rows <- WorkspacePersist.lock_nodes(community),
         node <- node(input, content),
         {:ok, result} <-
           TreeOrder.insert(Enum.map(rows, &Map.take(&1, @fields)), node, input.index),
         {:ok, :pass} <- WorkspacePersist.save(community, rows, result.changed),
         {:ok, queue} <-
           Queue.advance(community, queue, %{tree_lock_version: revision}, [:tree_lock_version]) do
      {:ok,
       %{
         node_id: node.node_id,
         article_id: node.doc_id,
         working_copy_id: work_id(content),
         tree_revision: queue.tree_lock_version
       }}
    end
  end

  def run(_, _, _, _, _), do: {:error, :invalid_tree_input}

  defp normalize(%{type: type, title: title} = attrs)
       when type in [:tab, :group, :page, :link, :pin] and is_binary(title) do
    index = Map.get(attrs, :index) || 2_147_483_647

    if is_integer(index) and index >= 0 do
      {:ok,
       %{
         type: type,
         title: title,
         parent_node_id: Map.get(attrs, :parent_node_id),
         index: index,
         href: Map.get(attrs, :href),
         marker: Map.get(attrs, :marker),
         badge: Map.get(attrs, :badge),
         hidden: Map.get(attrs, :hidden, false)
       }}
    else
      {:error, :invalid_tree_input}
    end
  end

  defp normalize(_), do: {:error, :invalid_tree_input}

  defp create_content(community, %{type: :page, title: title}, actor) do
    CMS.Docs.Content.create_workspace(community, %{title: title}, actor)
  end

  defp create_content(_, _, _), do: {:ok, nil}

  defp node(input, content) do
    %{
      node_id: Ecto.UUID.generate(),
      type: input.type,
      parent_node_id: input.parent_node_id,
      index: input.index,
      title: input.title,
      href: input.href,
      doc_id: article_id(content),
      marker: input.marker,
      badge: input.badge,
      hidden: input.hidden
    }
  end

  defp article_id(nil), do: nil
  defp article_id(%{article: article}), do: article.id
  defp work_id(nil), do: nil
  defp work_id(%{working_copy: work}), do: work.id
end
