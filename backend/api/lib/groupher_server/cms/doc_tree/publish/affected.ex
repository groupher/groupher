defmodule GroupherServer.CMS.DocTree.Publish.Affected do
  @moduledoc """
  Determines and locks the Doc identities affected by a complete Queue plan.

    The caller holds the site lock and must take content and Lifecycle locks later.

      QueueRelease -> Affected -> locked Article identities for the release
  """

  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.Publish.{TargetTree, TreeCodec, TreeOperations}
  alias CMS.Model.{Article, ArticleBinding, Community, DocsTreeNode}

  @fields ~w(node_id type parent_node_id index title href doc_id marker badge hidden)a

  @doc "Locks affected Articles in stable order, including pages below changed parents."
  def lock(%Community{} = community, ids, changes) do
    public =
      Repo.all(
        from(n in DocsTreeNode,
          where: n.community_id == ^community.id and n.stage == :public,
          order_by: n.node_id,
          lock: "FOR SHARE"
        )
      )
      |> Enum.map(&Map.take(&1, @fields))

    with {:ok, public} <- TargetTree.build(public, []),
         {:ok, decoded} <- TreeCodec.decode_changes(changes),
         {:ok, plan} <- TreeOperations.plan(public, decoded) do
      previous = public |> Enum.filter(&(&1.type == :page)) |> MapSet.new(& &1.doc_id)
      target = plan.target |> Enum.filter(&(&1.type == :page)) |> MapSet.new(& &1.doc_id)
      deleted = MapSet.difference(previous, target) |> MapSet.to_list() |> Enum.sort()
      changed_nodes = MapSet.new(decoded, & &1.node_id)

      affected =
        (ids ++
           deleted ++
           pages_affected(public, changed_nodes) ++
           pages_affected(plan.target, changed_nodes))
        |> Enum.uniq()
        |> Enum.sort()

      locked =
        Repo.all(from(a in Article, where: a.id in ^affected, order_by: a.id, lock: "FOR UPDATE"))

      bindings =
        Repo.all(
          from(b in ArticleBinding,
            where: b.article_id in ^affected and b.community_id == ^community.id,
            order_by: b.article_id,
            lock: "FOR SHARE"
          )
        )

      cond do
        length(locked) != length(affected) or Enum.any?(locked, &(&1.thread != :doc)) ->
          {:error, :invalid_doc_identity}

        length(bindings) != length(affected) or Enum.any?(bindings, &(&1.thread != :doc)) ->
          {:error, :invalid_doc_binding}

        true ->
          {:ok, %{deleted: deleted, article_ids: affected}}
      end
    end
  end

  defp pages_affected(nodes, changed_nodes) do
    by_id = Map.new(nodes, &{&1.node_id, &1})

    nodes
    |> Enum.filter(&(&1.type == :page and changed_ancestor?(&1, by_id, changed_nodes)))
    |> Enum.map(& &1.doc_id)
  end

  defp changed_ancestor?(node, by_id, changed_nodes) do
    cond do
      MapSet.member?(changed_nodes, node.node_id) -> true
      is_nil(node.parent_node_id) -> false
      true -> changed_ancestor?(Map.fetch!(by_id, node.parent_node_id), by_id, changed_nodes)
    end
  end
end
