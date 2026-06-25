defmodule GroupherServer.CMS.DocCover.Read do
  @moduledoc """
  Read projection for the public docs cover.

      doc_cover_groups -----> doc_tree_nodes(type=group)
             |
             +---- doc_cover_items -----> doc_tree_nodes(type=page)

      doc_cover_pinned_items ------------> doc_tree_nodes(type=page)

  The database stores cover rows and published tree references separately. This
  module returns the grouped projection expected by the frontend renderer.

      view: :public
          href -> /:community/doc/:slug

      view: :dashboard
          href -> /:community/dashboard/doc/editor?docId=:draft_doc_id

  `view` is intentionally about href generation only. Visibility filtering still
  uses public publish mappings, so dashboard preview and public docs look at the
  same cover rows unless a future editor projection adds an explicit scope.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Community,
    DocCoverGroup,
    DocCoverItem,
    DocCoverPinnedItem,
    DocTreeNode,
    DocTreeNodePublishMapping
  }

  alias Helper.T

  @type view :: :public | :dashboard

  @view_values [:public, :dashboard]
  @doc "Allowed cover read views."
  def view_values, do: @view_values

  @doc """
  Reads visible cover groups, items, and pinned items for one community.
  """
  @spec read(Community.t(), view()) :: T.domain_res(map())
  def read(%Community{} = community, view \\ :public) when view in @view_values do
    groups =
      DocCoverGroup
      |> where([g], g.community_id == ^community.id)
      |> join(:inner, [g], m in DocTreeNodePublishMapping,
        on:
          m.community_id == g.community_id and m.published_node_id == g.group_id and
            m.visibility == :public
      )
      |> order_by([g, _m], asc: g.index, asc: g.id)
      |> preload(:group)
      |> Repo.all()

    group_ids = Enum.map(groups, & &1.id)

    items =
      DocCoverItem
      |> where([i], i.community_id == ^community.id)
      |> where([i], i.cover_group_id in ^group_ids)
      |> where([i], i.hidden == false)
      |> join(:inner, [i], m in DocTreeNodePublishMapping,
        on:
          m.community_id == i.community_id and m.published_node_id == i.node_id and
            m.visibility == :public
      )
      |> order_by([i, _m], asc: i.index, asc: i.id)
      |> preload(:node)
      |> Repo.all()

    pinned_items =
      DocCoverPinnedItem
      |> where([i], i.community_id == ^community.id)
      |> join(:inner, [i], m in DocTreeNodePublishMapping,
        on:
          m.community_id == i.community_id and m.published_node_id == i.node_id and
            m.visibility == :public
      )
      |> order_by([i, _m], asc: i.index, asc: i.id)
      |> preload(:node)
      |> Repo.all()

    items_by_group =
      items
      |> Enum.reject(&hidden_node?/1)
      |> Enum.group_by(& &1.cover_group_id)

    pinned_items = Enum.reject(pinned_items, &hidden_node?/1)

    mappings_by_published_node =
      published_mappings_by_node(community, groups, items, pinned_items)

    {:ok,
     %{
       groups:
         Enum.map(groups, fn group ->
           cover_group_map(
             community,
             view,
             mappings_by_published_node,
             group,
             Map.get(items_by_group, group.id, [])
           )
         end),
       pinned_items:
         pinned_items
         |> Enum.map(&pinned_item_map(community, view, mappings_by_published_node, &1))
         |> Enum.filter(&displayable_item?/1)
     }}
  end

  defp cover_group_map(
         %Community{} = community,
         view,
         mappings_by_published_node,
         %DocCoverGroup{} = group,
         items
       ) do
    group_node =
      node_map(community, view, group.group, Map.get(mappings_by_published_node, group.group_id))

    %{
      id: group.id,
      group_id: group.group_id,
      index: group.index,
      ui_config: group.ui_config || %{},
      title: group_node.title,
      group: group_node,
      items:
        items
        |> Enum.map(&cover_item_map(community, view, mappings_by_published_node, &1))
        |> Enum.filter(&displayable_item?/1)
    }
  end

  defp cover_item_map(
         %Community{} = community,
         view,
         mappings_by_published_node,
         %DocCoverItem{} = item
       ) do
    node = node_map(community, view, item.node, Map.get(mappings_by_published_node, item.node_id))

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

  defp pinned_item_map(
         %Community{} = community,
         view,
         mappings_by_published_node,
         %DocCoverPinnedItem{} = item
       ) do
    node = node_map(community, view, item.node, Map.get(mappings_by_published_node, item.node_id))

    %{
      id: item.id,
      node_id: item.node_id,
      index: item.index,
      ui_config: item.ui_config || %{},
      # Pinned cover items use the same display fields as grouped items, plus
      # their cover-local visual configuration.
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

  defp node_map(%Community{} = community, view, %DocTreeNode{} = node, mapping) do
    %{
      id: node.id,
      parent_id: node.parent_id,
      doc_id: node.doc_id,
      type: node.type,
      title: node.title,
      slug: node.slug,
      index: node.index,
      href: node_href(community, view, node, mapping),
      marker: node.marker,
      badge: node.badge,
      hidden: node.hidden,
      expanded: node.expanded,
      children: []
    }
  end

  defp node_href(_community, :public, %DocTreeNode{href: href}, _mapping)
       when is_binary(href) and href != "",
       do: href

  defp node_href(%Community{slug: community}, :public, %DocTreeNode{slug: slug}, _mapping)
       when is_binary(slug) and slug != "" do
    "/#{community}/doc/#{slug}"
  end

  defp node_href(%Community{slug: community}, :dashboard, _node, %DocTreeNodePublishMapping{
         draft_doc_id: draft_doc_id
       })
       when not is_nil(draft_doc_id) do
    query = URI.encode_query(%{docId: draft_doc_id})

    "/#{community}/dashboard/doc/editor?#{query}"
  end

  defp node_href(_community, _view, _node, _mapping), do: nil

  defp hidden_node?(%{node: %{hidden: true}}), do: true
  defp hidden_node?(_item), do: false

  defp displayable_item?(%{href: href}) when is_binary(href) and href != "", do: true
  defp displayable_item?(_item), do: false

  defp published_mappings_by_node(%Community{} = community, groups, items, pinned_items) do
    published_node_ids =
      groups
      |> Enum.map(& &1.group_id)
      |> Kernel.++(Enum.map(items, & &1.node_id))
      |> Kernel.++(Enum.map(pinned_items, & &1.node_id))
      |> Enum.uniq()

    DocTreeNodePublishMapping
    |> where([m], m.community_id == ^community.id)
    |> where([m], m.published_node_id in ^published_node_ids)
    |> where([m], m.visibility == :public)
    |> Repo.all()
    |> Map.new(&{&1.published_node_id, &1})
  end
end
