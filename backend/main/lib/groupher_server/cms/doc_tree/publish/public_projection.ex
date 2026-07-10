defmodule GroupherServer.CMS.DocTree.Publish.PublicProjection do
  @moduledoc """
  Applies staged tree events to public doc tree rows.

      doc_tree_events(owner=tree, status=staged)
          |
          +--> node.create / pin.add    -> upsert public row
          +--> node.delete / pin.remove -> delete public row or subtree
          +--> node.move / pin.reorder  -> update group/index
          +--> field updates            -> update public fields
          |
          v
      doc_tree_nodes(stage=public)

  This module materializes tree structure only. Article content publishing stays
  in `DocPublisher`, and release history stays in `Release`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, Doc, DocTreeEvent, DocTreeNode}
  alias Helper.ORM

  require CMS.Const

  @doc_tree_json_key_type CMS.Const.doc_tree_json_key(:type)
  @doc_tree_json_key_doc_id CMS.Const.doc_tree_json_key(:doc_id)
  @tree_node_type_group CMS.Const.tree_node_type(:group)
  @tree_node_type_page CMS.Const.tree_node_type(:page)
  @tree_node_type_link CMS.Const.tree_node_type(:link)
  @tree_node_type_pin CMS.Const.tree_node_type(:pin)
  @tree_node_type_group_key to_string(@tree_node_type_group)
  @tree_node_type_page_key to_string(@tree_node_type_page)
  @tree_node_type_link_key to_string(@tree_node_type_link)
  @tree_node_type_pin_key to_string(@tree_node_type_pin)

  @event_public_fields %{
    "title" => :title,
    "slug" => :slug,
    "href" => :href,
    "marker" => :marker,
    "badge" => :badge,
    "hidden" => :hidden,
    "uiConfig" => :ui_config,
    "ui_config" => :ui_config
  }

  @event_node_types %{
    @tree_node_type_group_key => @tree_node_type_group,
    @tree_node_type_page_key => @tree_node_type_page,
    @tree_node_type_link_key => @tree_node_type_link,
    @tree_node_type_pin_key => @tree_node_type_pin
  }

  def preapply_tree_delete_events(%Community{} = community, branch, events) do
    events
    |> Enum.filter(
      &(&1.event_type in [CMS.Const.tree_event(:node_delete), CMS.Const.tree_event(:pin_remove)])
    )
    |> apply_tree_events(community, branch)
  end

  def apply_tree_events(events, %Community{} = community, branch),
    do: apply_tree_events(community, branch, events)

  def apply_tree_events(%Community{} = community, branch, events) do
    events
    |> Enum.reduce_while(:ok, fn event, :ok ->
      case apply_tree_event(community, branch, event) do
        :ok -> {:cont, :ok}
        {:ok, _node} -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  def public_group_children(%Community{} = community, branch, group_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.group_id == ^group_id)
    |> Repo.all()
  end

  defp apply_tree_event(
         %Community{} = community,
         branch,
         %DocTreeEvent{event_type: type} = event
       )
       when type in [CMS.Const.tree_event(:node_create), CMS.Const.tree_event(:pin_add)] do
    node = event.payload["node"] || %{}

    with {:ok, attrs} <- public_attrs_from_event_node(community, branch, node) do
      upsert_public_node_attrs(community, branch, node["id"], attrs)
    end
  end

  defp apply_tree_event(
         %Community{} = community,
         branch,
         %DocTreeEvent{event_type: type} = event
       )
       when type in [CMS.Const.tree_event(:node_delete), CMS.Const.tree_event(:pin_remove)] do
    node = event.payload["node"] || %{}

    delete_public_node_by_node_id(community, branch, node["id"], node["type"])
  end

  defp apply_tree_event(
         %Community{} = community,
         branch,
         %DocTreeEvent{event_type: type} = event
       )
       when type in [CMS.Const.tree_event(:node_move), CMS.Const.tree_event(:pin_reorder)] do
    payload = event.payload

    update_public_node_by_node_id(community, branch, payload["nodeId"], %{
      group_id: payload["afterGroupId"],
      index: payload["afterIndex"]
    })
  end

  defp apply_tree_event(%Community{} = community, branch, %DocTreeEvent{} = event) do
    apply_tree_event_fallback(community, branch, event)
  end

  defp apply_tree_event_fallback(%Community{} = community, branch, %DocTreeEvent{} = event) do
    payload = event.payload

    with {:ok, field} <- field_atom(payload["field"]) do
      update_public_node_by_node_id(community, branch, payload["nodeId"], %{
        field => payload["after"]
      })
    end
  end

  defp public_attrs_from_event_node(
         %Community{} = community,
         branch,
         %{@doc_tree_json_key_type => @tree_node_type_page_key} = node
       ) do
    doc_id = node[@doc_tree_json_key_doc_id]

    with {:ok, _draft} <-
           ORM.find_by(Doc,
             doc_id: doc_id,
             branch_id: branch.id,
             community_id: community.id
           ) do
      {:ok,
       %{
         community_id: community.id,
         branch_id: branch.id,
         node_id: node["id"],
         stage: CMS.Const.stage(:public),
         type: @tree_node_type_page,
         group_id: node["groupId"],
         doc_id: doc_id,
         title: node["title"],
         slug: node["slug"],
         index: node["index"] || 0,
         href: node["href"],
         marker: node["marker"],
         badge: node["badge"],
         hidden: Map.get(node, "hidden", false),
         ui_config: Map.get(node, "uiConfig", %{})
       }}
    else
      {:error, _} -> {:error, {:custom, "Publish docs before publishing tree."}}
      error -> error
    end
  end

  defp public_attrs_from_event_node(%Community{} = community, branch, node) do
    with {:ok, type} <- node_type_atom(node["type"]) do
      {:ok,
       %{
         community_id: community.id,
         branch_id: branch.id,
         node_id: node["id"],
         stage: CMS.Const.stage(:public),
         type: type,
         group_id: node["groupId"],
         doc_id: nil,
         title: node["title"],
         slug: node["slug"],
         index: node["index"] || 0,
         href: node["href"],
         marker: node["marker"],
         badge: node["badge"],
         hidden: Map.get(node, "hidden", false),
         ui_config: Map.get(node, "uiConfig", %{})
       }}
    end
  end

  defp upsert_public_node_attrs(%Community{} = community, branch, node_id, attrs) do
    case public_node_by_identity(community, branch, node_id, attrs) do
      %DocTreeNode{} = node -> ORM.update(node, attrs)
      nil -> ORM.create(DocTreeNode, attrs)
    end
  end

  defp update_public_node_by_node_id(%Community{} = community, branch, node_id, attrs) do
    case public_node_by_node_id(community, branch, node_id) do
      %DocTreeNode{} = node -> ORM.update(node, attrs)
      nil -> {:ok, :missing}
    end
  end

  defp delete_public_node_by_node_id(%Community{} = community, branch, node_id, node_type) do
    case public_node_by_node_id(community, branch, node_id) do
      %DocTreeNode{type: @tree_node_type_group} = node ->
        with :ok <- delete_public_group_children(community, branch, node.node_id) do
          ORM.delete(node)
        end

      %DocTreeNode{} = node ->
        ORM.delete(node)

      nil when node_type == @tree_node_type_group_key ->
        delete_public_group_children(community, branch, node_id)

      nil ->
        {:ok, :missing}
    end
  end

  defp delete_public_group_children(%Community{} = community, branch, group_id) do
    community
    |> public_group_children(branch, group_id)
    |> Enum.reduce_while(:ok, fn node, :ok ->
      case ORM.delete(node) do
        {:ok, _node} -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  defp public_node_by_node_id(%Community{} = community, branch, node_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.node_id == ^to_string(node_id))
    |> Repo.one()
  end

  defp field_atom(field) do
    case Map.fetch(@event_public_fields, field) do
      {:ok, atom} -> {:ok, atom}
      :error -> {:error, {:custom, "Unsupported docs tree field: #{field}"}}
    end
  end

  defp node_type_atom(type) do
    case Map.fetch(@event_node_types, type) do
      {:ok, atom} -> {:ok, atom}
      :error -> {:error, {:custom, "Unsupported docs tree node type: #{type}"}}
    end
  end

  defp public_node_by_identity(%Community{} = community, branch, node_id, attrs) do
    public_node_by_node_id(community, branch, node_id) ||
      public_node_by_unique_attrs(community, branch, attrs)
  end

  defp public_node_by_unique_attrs(
         %Community{} = community,
         branch,
         %{type: @tree_node_type_group, group_id: nil} = attrs
       ) do
    public_root_group_by_slug(community, branch, Map.get(attrs, :slug)) ||
      public_root_group_by_title(community, branch, Map.get(attrs, :title))
  end

  defp public_node_by_unique_attrs(
         %Community{} = community,
         branch,
         %{group_id: group_id} = attrs
       )
       when not is_nil(group_id) do
    public_child_by_slug(community, branch, group_id, Map.get(attrs, :slug)) ||
      public_child_by_title(community, branch, group_id, Map.get(attrs, :title))
  end

  defp public_node_by_unique_attrs(_community, _branch, _attrs), do: nil

  defp public_root_group_by_slug(_community, _branch, slug) when is_nil(slug) or slug == "",
    do: nil

  defp public_root_group_by_slug(%Community{} = community, branch, slug) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.type == @tree_node_type_group)
    |> where([n], is_nil(n.group_id))
    |> where([n], n.slug == ^slug)
    |> order_by([n], desc: n.updated_at, desc: n.id)
    |> limit(1)
    |> Repo.one()
  end

  defp public_root_group_by_title(_community, _branch, title) when is_nil(title) or title == "",
    do: nil

  defp public_root_group_by_title(%Community{} = community, branch, title) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.type == @tree_node_type_group)
    |> where([n], is_nil(n.group_id))
    |> where([n], n.title == ^title)
    |> order_by([n], desc: n.updated_at, desc: n.id)
    |> limit(1)
    |> Repo.one()
  end

  defp public_child_by_slug(_community, _branch, _group_id, slug) when is_nil(slug) or slug == "",
    do: nil

  defp public_child_by_slug(%Community{} = community, branch, group_id, slug) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.group_id == ^group_id)
    |> where([n], n.slug == ^slug)
    |> order_by([n], desc: n.updated_at, desc: n.id)
    |> limit(1)
    |> Repo.one()
  end

  defp public_child_by_title(_community, _branch, _group_id, title)
       when is_nil(title) or title == "",
       do: nil

  defp public_child_by_title(%Community{} = community, branch, group_id, title) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.group_id == ^group_id)
    |> where([n], n.title == ^title)
    |> order_by([n], desc: n.updated_at, desc: n.id)
    |> limit(1)
    |> Repo.one()
  end
end
