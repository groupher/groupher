defmodule GroupherServer.CMS.DocTree.Writer.Identity do
  @moduledoc """
  Normalizes Doc slugs and protects navigation titles inside sibling scopes.

      input title/slug
          |
          v
      trim + title-derived slug fallback
          |
          v
      draft siblings + trashed nodes
          |
          +--> create      -> auto-suffix title
          +--> page create -> copy-style suffix when identity is occupied
          +--> update      -> reject collision with pending restore

  Tree nodes do not own slugs. Current Trash snapshots reserve navigation
  titles because they may be restored; Page slug uniqueness is handled against
  the Doc records.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, Doc, DocTreeNode, TrashedDocTreeNode}
  alias Helper.Validator.Slug

  require CMS.Const

  # Explicit slugs are user input and win over title-derived slugs; title is
  # still trimmed when both are present.
  @doc """
  Normalizes a navigation title and its derived slug.

  Explicit user slugs win over title-derived slugs; both are trimmed.

  ## Examples

      Identity.normalize_title_slug(%{title: "  Getting Started  "})
      #=> %{title: "Getting Started", slug: "getting-started"}

      Identity.normalize_title_slug(%{title: " Getting Started ", slug: "  custom-slug  "})
      #=> %{title: "Getting Started", slug: "custom-slug"}

  """
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

  def unique_create_identity(attrs, %Community{} = community, branch, parent_node_id) do
    title = Map.get(attrs, :title)
    type = Map.get(attrs, :type)

    Map.put(
      attrs,
      :title,
      unique_value(community, branch, parent_node_id, type, :title, title, " ")
    )
  end

  def unique_create_page_identity(attrs, %Community{} = community, branch, parent_node_id) do
    title = Map.get(attrs, :title)
    slug = Map.get(attrs, :slug)
    type = Map.get(attrs, :type)

    if sibling_value_exists?(community, branch, parent_node_id, type, :title, title) do
      attrs
      |> Map.put(
        :title,
        unique_value(community, branch, parent_node_id, type, :title, "#{title}-copy", "-")
      )
      |> Map.put(:slug, unique_doc_slug(community, branch, slug))
    else
      Map.put(attrs, :slug, unique_doc_slug(community, branch, slug))
    end
  end

  def unique_copy_title(community, branch, parent_node_id, title),
    do: unique_value(community, branch, parent_node_id, nil, :title, "#{title} copy", " ")

  def unique_doc_slug(%Community{} = community, branch, slug) do
    existing =
      Doc
      |> where([d], d.community_id == ^community.id)
      |> where([d], d.branch_id == ^branch.id)
      |> where([d], d.stage == CMS.Const.stage(:draft))
      |> select([d], d.slug)
      |> Repo.all()
      |> MapSet.new()

    if MapSet.member?(existing, slug),
      do: unique_from_set(existing, "#{slug}-copy", "-"),
      else: slug
  end

  def validate_pending_deleted_identity(
        %Community{} = community,
        branch,
        %DocTreeNode{} = node,
        attrs
      ) do
    [:title]
    |> Enum.reduce_while(:ok, fn field, :ok ->
      if Map.has_key?(attrs, field) and Map.get(attrs, field) != Map.get(node, field) and
           pending_deleted_value_exists?(
             community,
             branch,
             node.parent_node_id,
             node.type,
             field,
             Map.get(attrs, field)
           ) do
        {:halt,
         {:error,
          GroupherServer.ErrorCat.custom(
            "A trashed tree item with this title is pending restore."
          )}}
      else
        {:cont, :ok}
      end
    end)
  end

  defp trim_title(%{title: title} = args) when is_binary(title),
    do: Map.put(args, :title, String.trim(title))

  defp trim_title(args), do: args

  defp sibling_value_exists?(_community, _branch, _group_id, _type, _field, nil), do: false

  defp sibling_value_exists?(community, branch, parent_node_id, type, field, value) do
    draft_sibling_value_exists?(community, branch, parent_node_id, type, field, value) ||
      pending_deleted_value_exists?(community, branch, parent_node_id, type, field, value)
  end

  defp unique_value(_community, _branch, _group_id, _type, _field, nil, _separator), do: nil

  defp unique_value(community, branch, parent_node_id, type, field, base, separator) do
    existing =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where_sibling_scope(parent_node_id, type)
      |> select([n], field(n, ^field))
      |> Repo.all()
      |> MapSet.new()
      |> MapSet.union(pending_deleted_values(community, branch, parent_node_id, type, field))

    Stream.iterate(0, &(&1 + 1))
    |> Enum.find_value(fn
      0 ->
        if MapSet.member?(existing, base), do: nil, else: base

      index ->
        value = "#{base}#{separator}#{index}"
        if MapSet.member?(existing, value), do: nil, else: value
    end)
  end

  defp draft_sibling_value_exists?(community, branch, parent_node_id, type, field, value) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> where_sibling_scope(parent_node_id, type)
    |> where([n], field(n, ^field) == ^value)
    |> Repo.exists?()
  end

  defp pending_deleted_value_exists?(_community, _branch, _group_id, _type, _field, nil),
    do: false

  defp pending_deleted_value_exists?(community, branch, parent_node_id, type, field, value) do
    community
    |> pending_deleted_values(branch, parent_node_id, type, field)
    |> MapSet.member?(value)
  end

  defp pending_deleted_values(%Community{} = community, branch, parent_node_id, type, field) do
    community
    |> pending_deleted_nodes(branch)
    |> Enum.filter(&pending_deleted_node_in_scope?(&1, parent_node_id, type))
    |> Enum.map(&Map.get(&1, Atom.to_string(field)))
    |> Enum.reject(&is_nil/1)
    |> MapSet.new()
  end

  defp pending_deleted_nodes(%Community{} = community, branch) do
    TrashedDocTreeNode
    |> where([item], item.community_id == ^community.id)
    |> where([item], item.branch_id == ^branch.id)
    |> where([item], not is_nil(item.draft_snapshot))
    |> select([item], item.draft_snapshot)
    |> Repo.all()
  end

  defp pending_deleted_node_in_scope?(node, nil, nil),
    do: is_nil(node["parentNodeId"])

  defp pending_deleted_node_in_scope?(node, nil, type),
    do: is_nil(node["parentNodeId"]) and node["type"] == to_string(type)

  defp pending_deleted_node_in_scope?(node, parent_id, :pin),
    do: node["parentNodeId"] == parent_id and node["type"] == "pin"

  defp pending_deleted_node_in_scope?(node, parent_id, _type),
    do: node["parentNodeId"] == parent_id and node["type"] != "pin"

  defp where_sibling_scope(query, nil, :tab),
    do: query |> where([n], is_nil(n.parent_node_id)) |> where([n], n.type == :tab)

  defp where_sibling_scope(query, parent_node_id, :pin),
    do:
      query
      |> where([n], n.parent_node_id == ^parent_node_id)
      |> where([n], n.type == :pin)

  defp where_sibling_scope(query, parent_node_id, _type),
    do:
      query
      |> where([n], n.parent_node_id == ^parent_node_id)
      |> where([n], n.type in [:group, :page, :link])

  defp unique_from_set(existing, base, separator) do
    Stream.iterate(0, &(&1 + 1))
    |> Enum.find_value(fn
      0 ->
        if MapSet.member?(existing, base), do: nil, else: base

      index ->
        value = "#{base}#{separator}#{index}"
        if MapSet.member?(existing, value), do: nil, else: value
    end)
  end
end
