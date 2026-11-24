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
  def apply(%Community{} = community, tree, items_by_target, actor, operation_ref)
      when is_map(tree) and is_map(items_by_target) and is_binary(operation_ref) do
    with {:ok, %{nodes: nodes, conflicting_doc_ids: []}} <- plan(community, tree, items_by_target) do
      WorkspaceUpdate.import_nodes(community, nodes, actor, operation_ref)
    else
      {:ok, %{conflicting_doc_ids: [_ | _]}} -> {:error, :duplicate_tree_identity}
      {:error, _} = error -> error
    end
  end

  def apply(_, _, _, _, _), do: {:error, :invalid_import_tree}

  @doc "Resolves stable workspace identities and reports the affected page IDs for Review."
  def plan(community, %{"namespace" => namespace, "tabs" => tabs}, targets)
      when is_binary(namespace) and namespace != "" do
    with {:ok, nodes} <- flatten_tabs(community, namespace, tabs, targets) do
      rows =
        Repo.all(
          from(n in DocsTreeNode, where: n.community_id == ^community.id and n.stage == :draft)
        )

      resolve_nodes(nodes, rows)
    end
  end

  def plan(_, _, _), do: {:error, ErrorCat.custom("invalid imported Doc tree")}

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

  defp resolve_nodes(nodes, existing) do
    by_id = Map.new(existing, &{&1.node_id, &1})
    by_doc = Map.new(Enum.filter(existing, & &1.doc_id), &{&1.doc_id, &1.node_id})

    by_title =
      Map.new(
        Enum.reject(existing, &(&1.type == :pin)),
        &{{&1.parent_node_id, &1.title}, &1.node_id}
      )

    resolved =
      Enum.map(nodes, fn
        %{type: :page, doc_id: id} = page -> %{page | node_id: Map.get(by_doc, id, page.node_id)}
        node -> node
      end)

    conflicts =
      Enum.reduce(resolved, MapSet.new(), fn node, blocked ->
        owner = by_id[node.node_id]
        title_owner = by_title[{node.parent_node_id, node.title}]

        if (owner && (owner.type != node.type or owner.doc_id != node.doc_id)) ||
             (node.type != :pin and title_owner != nil and title_owner != node.node_id) do
          # Links accompany the selected pages in their group.
          key = if node.type in [:link, :pin], do: node.parent_node_id, else: node.node_id
          MapSet.put(blocked, key)
        else
          blocked
        end
      end)

    # flatten_tabs emits parents before children, so a conflicting ancestor
    # affects exactly the pages below it.
    {_, ids} =
      Enum.reduce(resolved, {conflicts, []}, fn node, {blocked, ids} ->
        if MapSet.member?(blocked, node.node_id) or MapSet.member?(blocked, node.parent_node_id) do
          {MapSet.put(blocked, node.node_id), if(node.doc_id, do: [node.doc_id | ids], else: ids)}
        else
          {blocked, ids}
        end
      end)

    {:ok, %{nodes: resolved, conflicting_doc_ids: Enum.reverse(ids)}}
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
