defmodule GroupherServer.CMS.DocTree.Import do
  @moduledoc """
  Projects one imported navigation tree inside the caller's Doc apply transaction.

  Imported source identities are hashed into stable `node_id` values. Existing
  nodes are updated in place, new nodes are inserted, and nodes absent from a
  later source snapshot are deliberately retained until the user resolves the
  `source_deleted` diff.

      PlanPayload.tree + successfully admitted items_by_target
                              |
                              v
      tabs -> recursive Groups (Group/Page/Link pages) + pins
                              |
                              v
              flatten in source order        O(N)
                              |
                              v
              validate complete tree and permissions
                              |
                              v
              preserve unmentioned nodes
                              |
                              v
              validated workspace persistence
                              |
                              v
              rebuild returned source order
                              |
                              v
                    advance workspace revision

  Page nodes whose content item was skipped are not projected. Unmentioned
  existing nodes are not deleted here; `source_deleted` is an explicit import
  resolution handled later by the orchestrator.
  """

  require GroupherServer.CMS.Const

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.ErrorCat

  alias CMS.DocTree.WorkspaceUpdate
  alias CMS.Model.{Community, DocsTreeNode}

  @doc "Projects confirmed source navigation into the workspace without changing Queue membership or navigation."
  def apply(%Community{} = community, tree, items_by_target, actor)
      when is_map(tree) and is_map(items_by_target) do
    with namespace when is_binary(namespace) and namespace != "" <- Map.get(tree, "namespace"),
         {:ok, attrs} <-
           flatten_tabs(community, namespace, Map.get(tree, "tabs", []), items_by_target),
         attrs <- reuse_existing_node_ids(attrs),
         {:ok, result} <- WorkspaceUpdate.import_nodes(community, attrs, actor) do
      {:ok, result}
    else
      namespace when namespace in [nil, ""] ->
        {:error, ErrorCat.custom("imported Doc tree namespace is required")}

      {:error, _} = error ->
        error
    end
  end

  defp flatten_tabs(community, namespace, tabs, items_by_target) when is_list(tabs) do
    tabs
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn {tab, index}, {:ok, attrs} ->
      tab_id = node_id(:tab, namespace, tab["sourceId"])

      with {:ok, attrs} <-
             flatten_children(
               community,
               namespace,
               tab_id,
               Map.get(tab, "groups", []),
               items_by_target,
               [base_attrs(community, tab, :tab, tab_id, index) | attrs]
             ),
           {:ok, attrs} <-
             flatten_pins(
               community,
               namespace,
               tab_id,
               Map.get(tab, "pins", []),
               attrs
             ) do
        {:cont, {:ok, attrs}}
      else
        {:error, _} = error -> {:halt, error}
      end
    end)
    |> reverse_attrs()
  end

  defp flatten_tabs(_community, _namespace, _tabs, _items_by_target) do
    {:error, ErrorCat.custom("imported Doc tree tabs are invalid")}
  end

  defp flatten_children(
         community,
         namespace,
         parent_node_id,
         pages,
         items_by_target,
         attrs
       )
       when is_list(pages) do
    pages
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, attrs}, fn {child, index}, {:ok, attrs} ->
      case child["type"] do
        "group" ->
          group_node_id = node_id(:group, namespace, child["sourceId"])

          group_attrs =
            community
            |> base_attrs(child, :group, group_node_id, index)
            |> Map.put(:parent_node_id, parent_node_id)

          case flatten_children(
                 community,
                 namespace,
                 group_node_id,
                 Map.get(child, "pages", []),
                 items_by_target,
                 [group_attrs | attrs]
               ) do
            {:ok, next_attrs} -> {:cont, {:ok, next_attrs}}
            error -> {:halt, error}
          end

        "page" ->
          target_ref = child["docId"]

          if Map.has_key?(items_by_target, target_ref) do
            child_attrs =
              community
              |> base_attrs(
                child,
                :page,
                node_id(:page, namespace, child["sourceId"]),
                index
              )
              |> Map.put(:parent_node_id, parent_node_id)
              |> Map.put(:doc_id, target_ref)

            {:cont, {:ok, [child_attrs | attrs]}}
          else
            {:cont, {:ok, attrs}}
          end

        "link" ->
          child_attrs =
            community
            |> base_attrs(
              child,
              :link,
              node_id(:link, namespace, child["sourceId"]),
              index
            )
            |> Map.put(:parent_node_id, parent_node_id)
            |> Map.put(:href, child["href"])

          {:cont, {:ok, [child_attrs | attrs]}}

        _ ->
          {:halt, {:error, ErrorCat.custom("imported Doc tree child type is invalid")}}
      end
    end)
  end

  defp flatten_children(
         _community,
         _namespace,
         _parent_node_id,
         _children,
         _items_by_target,
         _attrs
       ) do
    {:error, ErrorCat.custom("imported Doc tree pages are invalid")}
  end

  defp flatten_pins(community, namespace, tab_id, pins, attrs) when is_list(pins) do
    pins
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, attrs}, fn {pin, index}, {:ok, attrs} ->
      pin_attrs =
        community
        |> base_attrs(
          pin,
          :pin,
          node_id(:pin, namespace, pin["sourceId"]),
          index
        )
        |> Map.put(:parent_node_id, tab_id)
        |> Map.put(:href, pin["href"])

      {:cont, {:ok, [pin_attrs | attrs]}}
    end)
  end

  defp flatten_pins(_community, _namespace, _tab_id, _pins, _attrs) do
    {:error, ErrorCat.custom("imported Doc tree pins are invalid")}
  end

  defp base_attrs(%Community{} = community, source, type, source_node_id, index) do
    %{
      community_id: community.id,
      node_id: source_node_id,
      stage: CMS.Const.stage(:draft),
      type: type,
      title: source["title"],
      index: index,
      parent_node_id: nil,
      doc_id: nil,
      href: nil,
      marker: nil,
      badge: nil,
      hidden: false
    }
  end

  # Import namespaces used to include the source revision. Reuse structural
  # identities from an earlier imported tree so a repeat import can update it
  # in place instead of colliding on root/sibling slugs or page doc_id.
  defp reuse_existing_node_ids([]), do: []

  defp reuse_existing_node_ids([first | _] = attrs) do
    existing =
      DocsTreeNode
      |> where(
        [node],
        node.community_id == ^first.community_id and node.stage == ^first.stage
      )
      |> Repo.all()
      |> existing_node_indexes()

    attrs
    |> Enum.map_reduce(%{}, fn attrs, replacements ->
      original_node_id = attrs.node_id

      attrs =
        attrs
        |> replace_parent_id(:parent_node_id, replacements)

      node_id = existing_node_id(existing, attrs) || original_node_id
      {Map.put(attrs, :node_id, node_id), Map.put(replacements, original_node_id, node_id)}
    end)
    |> elem(0)
  end

  defp existing_node_indexes(nodes) do
    %{
      by_doc_id: index_by(nodes, & &1.doc_id),
      by_parent_title: index_by(nodes, &{&1.parent_node_id, &1.type, &1.title}),
      by_node_id: Map.new(nodes, &{&1.node_id, &1.node_id}),
      by_root_title: index_by(nodes, &{&1.type, &1.title})
    }
  end

  defp index_by(nodes, key_fun) do
    nodes
    |> Enum.reject(&(key_fun.(&1) |> empty_index_key?()))
    |> Map.new(&{key_fun.(&1), &1.node_id})
  end

  defp empty_index_key?(nil), do: true

  defp empty_index_key?(key) when is_tuple(key) do
    key |> Tuple.to_list() |> Enum.any?(&is_nil/1)
  end

  defp empty_index_key?(_key), do: false

  defp replace_parent_id(attrs, field, replacements) do
    case Map.get(attrs, field) do
      nil -> attrs
      parent_id -> Map.put(attrs, field, Map.get(replacements, parent_id, parent_id))
    end
  end

  defp existing_node_id(indexes, %{node_id: node_id} = attrs) do
    indexes.by_node_id[node_id] || existing_structural_node_id(indexes, attrs)
  end

  defp existing_structural_node_id(indexes, %{type: :tab} = attrs) do
    indexes.by_root_title[{:tab, attrs.title}]
  end

  defp existing_structural_node_id(indexes, %{type: :page, doc_id: doc_id} = attrs) do
    indexes.by_doc_id[doc_id] || existing_child_id(indexes, attrs)
  end

  defp existing_structural_node_id(indexes, %{type: type} = attrs)
       when type in [:group, :link, :pin] do
    existing_child_id(indexes, attrs)
  end

  defp existing_structural_node_id(_indexes, _attrs), do: nil

  defp existing_child_id(indexes, attrs) do
    indexes.by_parent_title[{attrs.parent_node_id, attrs.type, attrs.title}]
  end

  defp reverse_attrs({:ok, attrs}), do: {:ok, Enum.reverse(attrs)}
  defp reverse_attrs(error), do: error

  defp node_id(type, namespace, source_id)
       when is_binary(namespace) and namespace != "" and is_binary(source_id) and source_id != "" do
    hash =
      :sha256
      |> :crypto.hash(
        :erlang.term_to_binary({:doc_tree_import_node_v2, type, namespace, source_id})
      )
      |> Base.encode16(case: :lower)

    "import:#{Atom.to_string(type)}:" <> String.slice(hash, 0, 48)
  end

  defp node_id(type, namespace, source_id), do: node_id(type, namespace, inspect(source_id))
end
