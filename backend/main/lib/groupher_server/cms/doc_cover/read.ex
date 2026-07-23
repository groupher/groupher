defmodule GroupherServer.CMS.DocCover.Read do
  @moduledoc """
  Read projection for the public docs cover.

      doc_cover_groups -----> doc_tree_nodes(type=group)
             |
             +---- doc_cover_items -----> doc_tree_nodes(type=page)

      doc_cover_pinned_docs -------------> doc_tree_nodes(type=page)

  The database stores cover rows and published tree references separately. This
  module returns the grouped projection expected by the frontend renderer.

      view: :public
          page href -> /:community/doc/:inner_id/:slug

      view: :dashboard
          href -> /:community/dashboard/doc/editor?docId=:doc_id

  `view` is intentionally about href generation only. Visibility filtering still
  uses public tree rows, so dashboard preview and public docs look at the same
  cover rows unless a future editor projection adds an explicit stage.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  require CMS.Const

  alias CMS.Model.{
    Community,
    Doc,
    DocCoverGroup,
    DocCoverItem,
    DocCoverPinnedDoc,
    DocTreeNode
  }

  alias Helper.T

  @type view :: :public | :dashboard

  @doc "Allowed cover read views."
  def view_values, do: CMS.Const.cover_view_enum_values()

  @doc """
  Reads visible cover groups, items, and pinned docs for one community.
  """
  @spec read(Community.t(), view()) :: T.domain_res(map())
  def read(%Community{} = community, view \\ CMS.Const.cover_view(:public))
      when view in CMS.Const.cover_view_values() do
    groups =
      DocCoverGroup
      |> where([g], g.community_id == ^community.id)
      |> order_by([g], asc: g.index, asc: g.id)
      |> preload(:group)
      |> Repo.all()

    group_ids = Enum.map(groups, & &1.id)

    items =
      DocCoverItem
      |> where([i], i.community_id == ^community.id)
      |> where([i], i.cover_group_id in ^group_ids)
      |> where([i], i.hidden == false)
      |> order_by([i], asc: i.index, asc: i.id)
      |> preload(:node)
      |> Repo.all()

    pinned_docs =
      DocCoverPinnedDoc
      |> where([i], i.community_id == ^community.id)
      |> order_by([i], asc: i.index, asc: i.id)
      |> preload(:node)
      |> Repo.all()

    items_by_group =
      items
      |> Enum.reject(&hidden_node?/1)
      |> Enum.group_by(& &1.cover_group_id)

    pinned_docs = Enum.reject(pinned_docs, &hidden_node?/1)

    public_docs_by_doc_id = public_docs_by_doc_id(community, groups, items, pinned_docs)
    draft_nodes_by_public_row = draft_nodes_by_public_row(community, groups, items, pinned_docs)

    {:ok,
     %{
       groups:
         Enum.map(groups, fn group ->
           cover_group_map(
             community,
             view,
             public_docs_by_doc_id,
             draft_nodes_by_public_row,
             group,
             Map.get(items_by_group, group.id, [])
           )
         end),
       pinned_docs:
         pinned_docs
         |> Enum.map(
           &pinned_doc_map(community, view, public_docs_by_doc_id, draft_nodes_by_public_row, &1)
         )
     }}
  end

  defp cover_group_map(
         %Community{} = community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_public_row,
         %DocCoverGroup{} = group,
         items
       ) do
    group_node =
      node_map(
        community,
        view,
        public_docs_by_doc_id,
        group.group,
        Map.get(draft_nodes_by_public_row, group.group_id)
      )

    %{
      id: group.id,
      group_id: group.group_id,
      index: group.index,
      ui_config: group.ui_config || %{},
      title: group_node.title,
      group: group_node,
      items:
        items
        |> Enum.map(
          &cover_item_map(community, view, public_docs_by_doc_id, draft_nodes_by_public_row, &1)
        )
        |> Enum.filter(&displayable_item?/1)
    }
  end

  defp cover_item_map(
         %Community{} = community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_public_row,
         %DocCoverItem{} = item
       ) do
    node =
      node_map(
        community,
        view,
        public_docs_by_doc_id,
        item.node,
        Map.get(draft_nodes_by_public_row, item.node_id)
      )

    %{
      id: item.id,
      node_id: item.node_id,
      index: item.index,
      hidden: item.hidden,
      # The docCover query is a front-end display model. Keep the node relation for
      # compatibility, but expose the fields layouts render directly.
      ui_config: item.ui_config || %{},
      type: node.type,
      doc_id: node.doc_id,
      title: node.title,
      href: node.href,
      marker: node.marker,
      digest: nil,
      badge: node.badge,
      node: node
    }
  end

  defp pinned_doc_map(
         %Community{} = community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_public_row,
         %DocCoverPinnedDoc{} = pinned_doc
       ) do
    node =
      node_map(
        community,
        view,
        public_docs_by_doc_id,
        pinned_doc.node,
        Map.get(draft_nodes_by_public_row, pinned_doc.node_id)
      )

    %{
      node_id: node.id,
      index: pinned_doc.index,
      appearance: pinned_doc.appearance || %{"light" => %{}, "dark" => %{}},
      href: node.href,
      doc: Map.fetch!(public_docs_by_doc_id, node.doc_id)
    }
  end

  defp node_map(
         %Community{} = community,
         view,
         public_docs_by_doc_id,
         %DocTreeNode{} = node,
         draft_node
       ) do
    %{
      id: node.node_id,
      group_id: node.group_id,
      doc_id: node.doc_id,
      type: node.type,
      title: node.title,
      slug: node.slug,
      index: node.index,
      href:
        node_href(
          community,
          view,
          node,
          Map.get(public_docs_by_doc_id, node.doc_id),
          draft_node
        ),
      marker: node.marker,
      badge: node.badge,
      hidden: node.hidden,
      children: []
    }
  end

  defp node_href(
         %Community{slug: community},
         :public,
         %DocTreeNode{type: :page},
         %Doc{
           inner_id: inner_id,
           slug: slug
         },
         _draft_node
       )
       when not is_nil(inner_id) and is_binary(slug) and slug != "" do
    "/#{community}/doc/#{inner_id}/#{slug}"
  end

  defp node_href(_community, :public, %DocTreeNode{href: href}, _public_doc, _draft_node)
       when is_binary(href) and href != "",
       do: href

  defp node_href(%Community{slug: community}, :dashboard, _node, _public_doc, %DocTreeNode{
         doc_id: doc_id
       })
       when not is_nil(doc_id) do
    query = URI.encode_query(%{docId: doc_id})

    "/#{community}/dashboard/doc/editor?#{query}"
  end

  defp node_href(_community, _view, _node, _public_doc, _draft_node), do: nil

  defp hidden_node?(%{node: %{hidden: true}}), do: true
  defp hidden_node?(_item), do: false

  defp displayable_item?(%{href: href}) when is_binary(href) and href != "", do: true
  defp displayable_item?(_item), do: false

  defp public_docs_by_doc_id(%Community{} = community, groups, items, pinned_docs) do
    doc_ids =
      [
        Enum.map(groups, & &1.group),
        Enum.map(items, & &1.node),
        Enum.map(pinned_docs, & &1.node)
      ]
      |> Enum.concat()
      |> Enum.reject(&is_nil/1)
      |> Enum.map(& &1.doc_id)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    Doc
    |> where([d], d.community_id == ^community.id)
    |> where([d], d.stage == CMS.Const.stage(:public))
    |> where([d], d.article_hash_id in ^doc_ids)
    |> Repo.all()
    |> Map.new(&{&1.article_hash_id, &1})
  end

  defp draft_nodes_by_public_row(%Community{} = community, groups, items, pinned_docs) do
    public_nodes =
      [
        Enum.map(groups, & &1.group),
        Enum.map(items, & &1.node),
        Enum.map(pinned_docs, & &1.node)
      ]
      |> Enum.concat()
      |> Enum.reject(&is_nil/1)

    node_ids = public_nodes |> Enum.map(& &1.node_id) |> Enum.uniq()

    draft_nodes =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where([n], n.node_id in ^node_ids)
      |> Repo.all()
      |> Map.new(&{&1.node_id, &1})

    public_nodes
    |> Enum.map(fn node -> {node.id, Map.get(draft_nodes, node.node_id)} end)
    |> Map.new()
  end
end
