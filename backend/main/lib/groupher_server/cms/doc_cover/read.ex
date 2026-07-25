defmodule GroupherServer.CMS.DocCover.Read do
  @moduledoc """
  Read projection for the public docs cover.

  A persisted Cover row selects one published Group. Card items are derived
  from that Group's direct public navigation entries:

      Page  -> page item
      Link  -> link item
      Group -> group item with recursive leaf_count and first-leaf href

  Nested descendants are never flattened into the parent Card.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, Doc, DocCoverPinnedDoc, DocCoverCard, DocTreeNode}
  alias Helper.T

  require CMS.Const

  @type view :: :public | :dashboard

  @doc "Allowed cover read views."
  def view_values, do: CMS.Const.cover_view_enum_values()

  @doc "Reads Group Cards and pinned docs for one community."
  @spec read(Community.t(), view()) :: T.domain_res(map())
  def read(%Community{} = community, view \\ CMS.Const.cover_view(:public))
      when view in CMS.Const.cover_view_values() do
    cards =
      DocCoverCard
      |> where([card], card.community_id == ^community.id)
      |> order_by([card], asc: card.index, asc: card.id)
      |> preload(:group_node)
      |> Repo.all()
      |> Enum.filter(&match?(%{group_node: %DocTreeNode{type: :group}}, &1))

    pinned_docs =
      DocCoverPinnedDoc
      |> where([pin], pin.community_id == ^community.id)
      |> order_by([pin], asc: pin.index, asc: pin.id)
      |> preload(:node)
      |> Repo.all()
      |> Enum.reject(&hidden_node?/1)

    nodes =
      DocTreeNode
      |> where([node], node.community_id == ^community.id)
      |> where([node], node.stage == CMS.Const.stage(:public))
      |> order_by([node], asc: node.index, asc: node.id)
      |> Repo.all()

    children_by_parent = Enum.group_by(nodes, & &1.parent_node_id)
    page_nodes = Enum.filter(nodes, &(&1.type == :page))
    public_docs_by_doc_id = public_docs_by_doc_id(community, page_nodes, pinned_docs)
    draft_nodes_by_node_id = draft_nodes_by_node_id(community, nodes)

    {:ok,
     %{
       cards:
         Enum.map(cards, fn card ->
           group = card.group_node

           %{
             id: card.id,
             group_node_id: group.node_id,
             index: card.index,
             appearance: card.appearance || %{},
             title: group.title,
             items:
               children_by_parent
               |> Map.get(group.node_id, [])
               |> Enum.map(
                 &card_item(
                   community,
                   view,
                   public_docs_by_doc_id,
                   draft_nodes_by_node_id,
                   children_by_parent,
                   &1
                 )
               )
               |> Enum.reject(&is_nil/1)
           }
         end),
       pinned_docs:
         Enum.map(
           pinned_docs,
           &pinned_doc_map(
             community,
             view,
             public_docs_by_doc_id,
             draft_nodes_by_node_id,
             &1
           )
         )
     }}
  end

  defp card_item(
         _community,
         _view,
         _public_docs_by_doc_id,
         _draft_nodes_by_node_id,
         _children_by_parent,
         %DocTreeNode{hidden: true}
       ),
       do: nil

  defp card_item(
         community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_node_id,
         _children_by_parent,
         %DocTreeNode{type: type} = node
       )
       when type in [:page, :link] do
    item = node_map(community, view, public_docs_by_doc_id, draft_nodes_by_node_id, node)

    if displayable_item?(item), do: item, else: nil
  end

  defp card_item(
         community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_node_id,
         children_by_parent,
         %DocTreeNode{type: :group} = group
       ) do
    leaves =
      visible_leaves(
        community,
        view,
        public_docs_by_doc_id,
        draft_nodes_by_node_id,
        children_by_parent,
        group.node_id,
        MapSet.new()
      )

    case leaves do
      [] ->
        nil

      [first | _] ->
        %{
          id: group.node_id,
          node_id: group.node_id,
          type: :group,
          title: group.title,
          index: group.index,
          href: first.href,
          marker: group.marker,
          badge: group.badge,
          leaf_count: length(leaves)
        }
    end
  end

  defp card_item(_community, _view, _docs, _drafts, _children, _node), do: nil

  defp visible_leaves(
         community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_node_id,
         children_by_parent,
         parent_node_id,
         seen
       ) do
    if MapSet.member?(seen, parent_node_id) do
      []
    else
      seen = MapSet.put(seen, parent_node_id)

      children_by_parent
      |> Map.get(parent_node_id, [])
      |> Enum.flat_map(fn
        %DocTreeNode{hidden: true} ->
          []

        %DocTreeNode{type: :group} = group ->
          visible_leaves(
            community,
            view,
            public_docs_by_doc_id,
            draft_nodes_by_node_id,
            children_by_parent,
            group.node_id,
            seen
          )

        %DocTreeNode{type: type} = node when type in [:page, :link] ->
          node
          |> node_map(community, view, public_docs_by_doc_id, draft_nodes_by_node_id)
          |> then(fn item -> if displayable_item?(item), do: [item], else: [] end)

        _node ->
          []
      end)
    end
  end

  defp node_map(
         %DocTreeNode{} = node,
         %Community{} = community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_node_id
       ),
       do: node_map(community, view, public_docs_by_doc_id, draft_nodes_by_node_id, node)

  defp node_map(
         %Community{} = community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_node_id,
         %DocTreeNode{} = node
       ) do
    %{
      id: node.node_id,
      node_id: node.node_id,
      doc_id: node.doc_id,
      type: node.type,
      title: node.title,
      index: node.index,
      href:
        node_href(
          community,
          view,
          node,
          Map.get(public_docs_by_doc_id, node.doc_id),
          Map.get(draft_nodes_by_node_id, node.node_id)
        ),
      marker: node.marker,
      badge: node.badge
    }
  end

  defp pinned_doc_map(
         community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_node_id,
         %DocCoverPinnedDoc{} = pinned_doc
       ) do
    node =
      node_map(
        community,
        view,
        public_docs_by_doc_id,
        draft_nodes_by_node_id,
        pinned_doc.node
      )

    %{
      node_id: node.id,
      index: pinned_doc.index,
      appearance: pinned_doc.appearance || %{"light" => %{}, "dark" => %{}},
      href: node.href,
      doc: Map.fetch!(public_docs_by_doc_id, node.doc_id)
    }
  end

  defp node_href(
         %Community{slug: community},
         :public,
         %DocTreeNode{type: :page},
         %Doc{inner_id: inner_id, slug: slug},
         _draft_node
       )
       when not is_nil(inner_id) and is_binary(slug) and slug != "",
       do: "/#{community}/doc/#{inner_id}/#{slug}"

  defp node_href(_community, :public, %DocTreeNode{type: :link, href: href}, _doc, _draft)
       when is_binary(href) and href != "",
       do: href

  defp node_href(%Community{slug: community}, :dashboard, %DocTreeNode{type: :page}, _doc, %{
         doc_id: doc_id
       })
       when not is_nil(doc_id) do
    "/#{community}/dashboard/doc/editor?#{URI.encode_query(%{docId: doc_id})}"
  end

  defp node_href(_community, :dashboard, %DocTreeNode{type: :link, href: href}, _doc, _draft)
       when is_binary(href) and href != "",
       do: href

  defp node_href(_community, _view, _node, _doc, _draft), do: nil

  defp hidden_node?(%{node: %{hidden: true}}), do: true
  defp hidden_node?(_item), do: false

  defp displayable_item?(%{href: href}) when is_binary(href) and href != "", do: true
  defp displayable_item?(_item), do: false

  defp public_docs_by_doc_id(%Community{} = community, page_nodes, pinned_docs) do
    doc_ids =
      [Enum.map(page_nodes, & &1.doc_id), Enum.map(pinned_docs, & &1.node.doc_id)]
      |> Enum.concat()
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    Doc
    |> where([doc], doc.community_id == ^community.id)
    |> where([doc], doc.stage == CMS.Const.stage(:public))
    |> where([doc], doc.article_hash_id in ^doc_ids)
    |> Repo.all()
    |> Map.new(&{&1.article_hash_id, &1})
  end

  defp draft_nodes_by_node_id(%Community{} = community, public_nodes) do
    node_ids = Enum.map(public_nodes, & &1.node_id)

    DocTreeNode
    |> where([node], node.community_id == ^community.id)
    |> where([node], node.stage == CMS.Const.stage(:draft))
    |> where([node], node.node_id in ^node_ids)
    |> Repo.all()
    |> Map.new(&{&1.node_id, &1})
  end
end
