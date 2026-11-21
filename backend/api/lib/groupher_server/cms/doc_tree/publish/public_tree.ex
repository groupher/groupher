defmodule GroupherServer.CMS.DocTree.Publish.PublicTree do
  @moduledoc """
  Applies the verified Queue directory plan to the site's public node rows.

      admitted Release -> site lock -> verified public tree and Queue -> target public tree

  The enclosing Release owns Gate, Lifecycle, Release history, Queue consumption,
  effects, Receipt and rollback. Existing logical nodes keep their row identity.
  """

  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.Publish.{Queue, TargetTree, TreeCodec, TreeOperations}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticlePublic,
    Community,
    DocsPublishQueue,
    DocsQueueTreeChange,
    DocsTreeNode
  }

  @fields ~w(node_id type parent_node_id index title href doc_id marker badge hidden)a

  @doc "Applies the complete Queue-derived public tree inside the caller-owned Release transaction."
  def apply(%Community{} = community, %DocsPublishQueue{} = queue, revision, plan)
      when is_integer(revision) and revision >= 0 and is_map(plan) do
    with {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: revision}, []),
         %{
           payload: %{
             "base_release_id" => base,
             "public_tree" => expected,
             "tree_operations" => operations
           },
           target: target
         } <- plan,
         true <- base == queue.public_release_id,
         rows <-
           Repo.all(
             from(n in DocsTreeNode,
               where: n.community_id == ^community.id and n.stage == :public,
               order_by: n.node_id,
               lock: "FOR UPDATE"
             )
           ),
         {:ok, current} <- TargetTree.build(Enum.map(rows, &Map.take(&1, @fields)), []),
         true <- current == expected,
         changes <-
           Repo.all(
             from(c in DocsQueueTreeChange,
               where: c.queue_id == ^queue.id,
               order_by: c.node_id,
               lock: "FOR UPDATE"
             )
           ),
         {:ok, decoded} <- TreeCodec.decode_changes(changes),
         {:ok, computed} <- TreeOperations.plan(current, decoded),
         true <- computed.target == target and computed.operations == operations,
         {:ok, :pass} <- validate_pages(community, target),
         {:ok, :pass} <- persist(community, rows, target) do
      {:ok, %{nodes: target}}
    else
      false -> {:error, :docs_public_tree_conflict}
      {:error, _reason} = error -> error
      _ -> {:error, :invalid_docs_public_tree_plan}
    end
  end

  def apply(_, _, _, _), do: {:error, :invalid_docs_public_tree_plan}

  defp validate_pages(community, target) do
    pages = Enum.filter(target, &(&1.type == :page))
    ids = Enum.map(pages, & &1.doc_id)

    found =
      Repo.all(
        from(a in Article,
          join: b in ArticleBinding,
          on: b.article_id == a.id and b.community_id == ^community.id,
          join: p in ArticlePublic,
          on: p.article_id == a.id,
          where: a.id in ^ids and a.thread == :doc and b.thread == :doc,
          select: a.id
        )
      )
      |> MapSet.new()

    cond do
      MapSet.size(found) != length(ids) -> {:error, :docs_public_page_not_published}
      true -> {:ok, :pass}
    end
  end

  defp persist(community, rows, target) do
    targets = Map.new(target, &{&1.node_id, &1})
    changed = Enum.filter(rows, &(Map.get(targets, &1.node_id) != Map.take(&1, @fields)))

    with {:ok, :pass} <- stage(community.id, changed, rows, targets),
         {:ok, :pass} <- remove_deleted(changed, targets),
         current <-
           Repo.all(
             from(n in DocsTreeNode,
               where: n.community_id == ^community.id and n.stage == :public
             )
           ),
         {:ok, :pass} <- save_target(community, target, Map.new(current, &{&1.node_id, &1})) do
      {:ok, :pass}
    end
  end

  defp stage(community_id, changed, all_rows, targets) do
    if length(changed) > 2_147_483_647 or Enum.any?(all_rows, &(&1.index < 0)) do
      {:error, :invalid_docs_tree_staging}
    else
      occupied = MapSet.new(all_rows, & &1.title)

      {_, result} =
        Enum.reduce_while(Enum.with_index(changed, 1), {occupied, {:ok, :pass}}, fn {row, index},
                                                                                    {names, _} ->
          name = temporary_title(names)
          updates = staging_fields(row, targets[row.node_id], -index, name)

          case Repo.update_all(
                 from(n in DocsTreeNode,
                   where:
                     n.id == ^row.id and
                       n.community_id == ^community_id and n.stage == :public
                 ),
                 set: updates
               ) do
            {1, nil} -> {:cont, {MapSet.put(names, name), {:ok, :pass}}}
            _ -> {:halt, {names, {:error, :docs_public_tree_changed}}}
          end
        end)

      result
    end
  end

  defp staging_fields(
         %DocsTreeNode{type: :page, doc_id: old},
         %{type: :page, doc_id: new},
         index,
         title
       )
       when old != new do
    [index: index, title: title, type: :group, doc_id: nil]
  end

  defp staging_fields(_row, _target, index, title), do: [index: index, title: title]

  defp temporary_title(names) do
    value = "__docs_release_" <> Ecto.UUID.generate()
    if MapSet.member?(names, value), do: temporary_title(names), else: value
  end

  defp remove_deleted(changed, targets) do
    ids = changed |> Enum.reject(&Map.has_key?(targets, &1.node_id)) |> Enum.map(& &1.id)

    case Repo.delete_all(from(n in DocsTreeNode, where: n.id in ^ids)) do
      {count, nil} when count == length(ids) -> {:ok, :pass}
      _ -> {:error, :docs_public_tree_changed}
    end
  end

  defp save_target(community, target, existing) do
    Enum.reduce_while(target, {:ok, :pass}, fn node, _ ->
      attrs =
        node |> Map.take(@fields) |> Map.merge(%{community_id: community.id, stage: :public})

      row = Map.get(existing, node.node_id) || %DocsTreeNode{}

      if Map.take(row, @fields) == node do
        {:cont, {:ok, :pass}}
      else
        case row |> DocsTreeNode.changeset(attrs) |> Repo.insert_or_update() do
          {:ok, _} -> {:cont, {:ok, :pass}}
          {:error, _reason} = error -> {:halt, error}
        end
      end
    end)
  end
end
