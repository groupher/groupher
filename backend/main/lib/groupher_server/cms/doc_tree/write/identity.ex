defmodule GroupherServer.CMS.DocTree.Write.Identity do
  @moduledoc """
  Normalizes and protects title/slug identity inside sibling scopes.

      input title/slug
          |
          v
      trim + title-derived slug fallback
          |
          v
      draft siblings + staged deleted nodes
          |
          +--> create      -> auto-suffix title/slug
          +--> page create -> copy-style suffix when identity is occupied
          +--> update      -> reject collision with pending restore/delete

  Pending delete events still reserve identity because they may be restored or
  published later. This keeps draft creates from silently stealing a title or
  slug that is still visible in the publish checklist.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocTreeEvent, DocTreeNode}
  alias Helper.Validator.Slug

  require CMS.Const

  @doc_tree_json_key_node CMS.Const.doc_tree_json_key(:node)

  # Explicit slugs are user input and win over title-derived slugs; title is
  # still trimmed when both are present.
  def normalize_title_slug(%{slug: slug} = args) when is_binary(slug) do
    args
    |> trim_title()
    |> Map.put(:slug, String.trim(slug))
  end

  def normalize_title_slug(%{title: title} = args) when is_binary(title) do
    title = String.trim(title)

    args
    |> Map.put(:title, title)
    |> Map.put(:slug, Slug.normalize(title))
  end

  def normalize_title_slug(args), do: args

  def unique_create_identity(attrs, %Community{} = community, branch, group_id) do
    title = Map.get(attrs, :title)
    slug = Map.get(attrs, :slug)
    type = Map.get(attrs, :type)

    attrs
    |> Map.put(:title, unique_value(community, branch, group_id, type, :title, title, " "))
    |> Map.put(:slug, unique_value(community, branch, group_id, type, :slug, slug, "-"))
  end

  def unique_create_page_identity(attrs, %Community{} = community, branch, group_id) do
    title = Map.get(attrs, :title)
    slug = Map.get(attrs, :slug)
    type = Map.get(attrs, :type)

    if sibling_value_exists?(community, branch, group_id, type, :title, title) or
         sibling_value_exists?(community, branch, group_id, type, :slug, slug) do
      attrs
      |> Map.put(
        :title,
        unique_value(community, branch, group_id, type, :title, "#{title}-copy", "-")
      )
      |> Map.put(
        :slug,
        unique_value(community, branch, group_id, type, :slug, "#{slug}-copy", "-")
      )
    else
      attrs
    end
  end

  def unique_copy_title(community, branch, group_id, title),
    do: unique_value(community, branch, group_id, nil, :title, "#{title} copy", " ")

  def unique_copy_slug(community, branch, group_id, slug),
    do: unique_value(community, branch, group_id, nil, :slug, "#{slug}-copy", "-")

  def validate_pending_deleted_identity(
        %Community{} = community,
        branch,
        %DocTreeNode{} = node,
        attrs
      ) do
    [:title, :slug]
    |> Enum.reduce_while(:ok, fn field, :ok ->
      if Map.has_key?(attrs, field) and Map.get(attrs, field) != Map.get(node, field) and
           pending_deleted_value_exists?(
             community,
             branch,
             node.tab_id || node.group_id,
             node.type,
             field,
             Map.get(attrs, field)
           ) do
        {:halt,
         {:error,
          {:custom, "A deleted tree item with this title or slug is pending restore or publish."}}}
      else
        {:cont, :ok}
      end
    end)
  end

  defp trim_title(%{title: title} = args) when is_binary(title),
    do: Map.put(args, :title, String.trim(title))

  defp trim_title(args), do: args

  defp sibling_value_exists?(_community, _branch, _group_id, _type, _field, nil), do: false

  defp sibling_value_exists?(community, branch, group_id, type, field, value) do
    draft_sibling_value_exists?(community, branch, group_id, type, field, value) ||
      pending_deleted_value_exists?(community, branch, group_id, type, field, value)
  end

  defp unique_value(_community, _branch, _group_id, _type, _field, nil, _separator), do: nil

  defp unique_value(community, branch, group_id, type, field, base, separator) do
    existing =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where_sibling_scope(group_id, type)
      |> select([n], field(n, ^field))
      |> Repo.all()
      |> MapSet.new()
      |> MapSet.union(pending_deleted_values(community, branch, group_id, type, field))

    Stream.iterate(0, &(&1 + 1))
    |> Enum.find_value(fn
      0 ->
        if MapSet.member?(existing, base), do: nil, else: base

      index ->
        value = "#{base}#{separator}#{index}"
        if MapSet.member?(existing, value), do: nil, else: value
    end)
  end

  defp draft_sibling_value_exists?(community, branch, group_id, type, field, value) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> where_sibling_scope(group_id, type)
    |> where([n], field(n, ^field) == ^value)
    |> Repo.exists?()
  end

  defp pending_deleted_value_exists?(_community, _branch, _group_id, _type, _field, nil),
    do: false

  defp pending_deleted_value_exists?(community, branch, group_id, type, field, value) do
    community
    |> pending_deleted_values(branch, group_id, type, field)
    |> MapSet.member?(value)
  end

  defp pending_deleted_values(%Community{} = community, branch, group_id, type, field) do
    community
    |> pending_deleted_nodes(branch)
    |> Enum.filter(&pending_deleted_node_in_scope?(&1, group_id, type))
    |> Enum.map(&Map.get(&1, Atom.to_string(field)))
    |> Enum.reject(&is_nil/1)
    |> MapSet.new()
  end

  defp pending_deleted_nodes(%Community{} = community, branch) do
    delete_event_types = [
      CMS.Const.tree_event(:node_delete),
      CMS.Const.tree_event(:pin_remove)
    ]

    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.branch_id == ^branch.id)
    |> where([e], e.status == CMS.Const.tree_event_status(:staged))
    |> where([e], e.owner == CMS.Const.tree_event_owner(:tree))
    |> where([e], e.event_type in ^delete_event_types)
    |> select([e], e.inverse_payload)
    |> Repo.all()
    |> Enum.flat_map(&nodes_from_delete_inverse/1)
  end

  defp nodes_from_delete_inverse(%{@doc_tree_json_key_node => node} = inverse)
       when is_map(node) do
    children =
      inverse
      |> Map.get("children", [])
      |> Enum.filter(&is_map/1)

    [node | children]
  end

  defp nodes_from_delete_inverse(_inverse), do: []

  defp pending_deleted_node_in_scope?(node, nil, nil),
    do: is_nil(node["tabId"]) and is_nil(node["groupId"])

  defp pending_deleted_node_in_scope?(node, nil, type),
    do: is_nil(node["tabId"]) and is_nil(node["groupId"]) and node["type"] == to_string(type)

  defp pending_deleted_node_in_scope?(node, parent_id, type) when type in [:group, :pin],
    do: node["tabId"] == parent_id and node["type"] == to_string(type)

  defp pending_deleted_node_in_scope?(node, parent_id, _type), do: node["groupId"] == parent_id

  defp where_sibling_scope(query, nil, :tab),
    do: query |> where([n], is_nil(n.tab_id) and is_nil(n.group_id)) |> where([n], n.type == :tab)

  defp where_sibling_scope(query, tab_id, type) when type in [:group, :pin],
    do: query |> where([n], n.tab_id == ^tab_id) |> where([n], n.type == ^type)

  defp where_sibling_scope(query, group_id, type) when type in [:page, :link],
    do: query |> where([n], n.group_id == ^group_id) |> where([n], n.type in [:page, :link])

  defp where_sibling_scope(query, group_id, nil) when not is_nil(group_id),
    do: where(query, [n], n.group_id == ^group_id)

  defp where_sibling_scope(query, nil, nil),
    do: where(query, [n], is_nil(n.tab_id) and is_nil(n.group_id))
end
