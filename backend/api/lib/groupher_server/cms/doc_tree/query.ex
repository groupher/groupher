defmodule GroupherServer.CMS.DocTree.Query do
  @moduledoc """
  Query helpers for the docs editor tree.

  The editor reads the draft stage. Public status is derived from the matching
  public-stage row with the same `node_id`.

      doc_tree_nodes(stage=draft)       doc_tree_nodes(stage=public)
      ---------------------------       ----------------------------
      node_id=group_1              -->  node_id=group_1
        node_id=page_1             -->    node_id=page_1

  GraphQL keeps `id` as the stable `node_id`; the physical database row id is
  intentionally not exposed.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.Gate.Context.Scope.Community, as: CommunityContext
  alias CMS.Model.{Article, Community, DocsTreeNode}

  alias Helper.T

  @doc """
  Reads the published docs tree used by the public docs site.

  The public projection omits editor-only state such as draft revisions,
  staged events, and publish status. Page hrefs are resolved from the
  published docs article row so drafts cannot leak into the public reader.
  """
  @spec read_public(Community.t()) :: T.domain_res(map())
  def read_public(%Community{} = community) do
    with {:ok, community} <- public_community(community) do
      nodes =
        Repo.all(
          from(n in DocsTreeNode,
            where: n.community_id == ^community.id and n.stage == :public,
            order_by: [asc: n.index, asc: n.id]
          )
        )

      docs_by_doc_id = public_docs_by_doc_id(community, nodes)

      {:ok, %{tabs: build_public_tabs(community, nodes, docs_by_doc_id)}}
    end
  end

  defp public_community(%Community{} = community) do
    case CMS.Gate.scope(Community, nil, :read, CommunityContext.public()) do
      %Ecto.Query{} = query ->
        query
        |> where([candidate], candidate.id == ^community.id)
        |> Repo.one()
        |> case do
          %Community{} = public_community -> {:ok, public_community}
          nil -> {:error, CMS.Communities.ErrorCat.not_exist("Community")}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp public_docs_by_doc_id(%Community{} = community, nodes) do
    doc_ids =
      nodes
      |> Enum.map(& &1.doc_id)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    Article
    |> CMS.Gate.scope(nil, :read, CMS.Gate.Context.Scope.Doc.public())
    |> where(
      [article, gate_article_binding: binding],
      binding.community_id == ^community.id and article.id in ^doc_ids
    )
    |> select([article, gate_article_binding: binding, gate_article_public: public], %{
      id: article.id,
      inner_id: binding.inner_id,
      slug: public.slug,
      title: public.title
    })
    |> Repo.all()
    |> Map.new(&{&1.id, &1})
  end

  defp build_public_tabs(%Community{} = community, nodes, docs_by_doc_id) do
    navigation_by_parent =
      nodes
      |> Enum.filter(&(&1.type in [:group, :page, :link]))
      |> Enum.group_by(& &1.parent_node_id)

    pins_by_tab =
      nodes
      |> Enum.filter(&(&1.type == :pin and not hidden_node?(&1)))
      |> Enum.map(fn pin -> pin |> public_node_base() |> Map.put(:href, pin.href) end)
      |> Enum.group_by(& &1.parent_node_id)

    nodes
    |> Enum.filter(&(&1.type == :tab))
    |> Enum.reject(&hidden_node?/1)
    |> Enum.flat_map(fn tab ->
      groups =
        build_public_children(
          community,
          tab.node_id,
          navigation_by_parent,
          docs_by_doc_id,
          MapSet.new()
        )

      pins = Map.get(pins_by_tab, tab.node_id, [])

      if groups == [] and pins == [] do
        []
      else
        [
          tab
          |> public_node_base()
          |> Map.put(:pins, pins)
          |> Map.put(:groups, groups)
        ]
      end
    end)
  end

  defp build_public_children(
         community,
         parent_node_id,
         children_by_parent,
         docs_by_doc_id,
         ancestors
       ) do
    if MapSet.member?(ancestors, parent_node_id) do
      []
    else
      ancestors = MapSet.put(ancestors, parent_node_id)

      children_by_parent
      |> Map.get(parent_node_id, [])
      |> Enum.sort_by(&{&1.index, &1.id})
      |> Enum.reject(&hidden_node?/1)
      |> Enum.flat_map(fn
        %DocsTreeNode{type: :group} = group ->
          pages =
            build_public_children(
              community,
              group.node_id,
              children_by_parent,
              docs_by_doc_id,
              ancestors
            )

          if pages == [] do
            []
          else
            [group |> public_node_base() |> Map.put(:pages, pages)]
          end

        node ->
          case public_child_map(community, node, docs_by_doc_id) do
            nil -> []
            child -> [child]
          end
      end)
    end
  end

  defp public_child_map(
         %Community{} = community,
         %DocsTreeNode{type: :page} = node,
         docs_by_doc_id
       ) do
    case Map.get(docs_by_doc_id, node.doc_id) do
      %{inner_id: inner_id, slug: slug} when is_integer(inner_id) and inner_id > 0 ->
        node
        |> public_node_base()
        |> Map.put(
          :href,
          CMS.FrontDesk.Article.url(%{
            community_slug: community.slug,
            thread: :doc,
            inner_id: inner_id,
            slug: slug
          })
        )

      _ ->
        nil
    end
  end

  defp public_child_map(
         _community,
         %DocsTreeNode{type: :link, href: href} = node,
         _docs_by_doc_id
       )
       when is_binary(href) and href != "" do
    node
    |> public_node_base()
    |> Map.put(:href, href)
  end

  defp public_child_map(_community, _node, _docs_by_doc_id), do: nil

  defp public_node_base(%DocsTreeNode{} = node) do
    %{
      id: node.node_id,
      parent_node_id: node.parent_node_id,
      doc_id: node.doc_id,
      type: node.type,
      title: node.title,
      index: node.index,
      href: nil,
      marker: node.marker,
      badge: node.badge,
      pages: []
    }
  end

  defp hidden_node?(%{hidden: true}), do: true
  defp hidden_node?(_node), do: false
end
