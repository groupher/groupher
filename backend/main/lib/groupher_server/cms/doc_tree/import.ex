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
      tabs -> groups -> pages/links + pins
                              |
                              v
              flatten in source order        O(N)
                              |
                              v
              validate every node changeset
                              |
                              v
              last source identity wins
                              |
                              v
              insert_all / 500-row batches
                              |
                              v
              rebuild returned source order
                              |
                              v
                    bump draft tree revision

  Page nodes whose content item was skipped are not projected. Unmentioned
  existing nodes are not deleted here; `source_deleted` is an explicit import
  resolution handled later by the orchestrator.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.ContentImport.Canonical
  alias CMS.DocTree.{Read, Revision}
  alias CMS.Model.{ArticleBranch, Community, DocTreeNode}

  require CMS.Const

  @insert_batch_size 500
  @managed_fields ~w(tab_id group_id doc_id type title slug index href updated_at)a

  @spec apply(Community.t(), ArticleBranch.t(), map(), map()) ::
          {:ok, %{nodes: [DocTreeNode.t()], state: CMS.Model.DocsSiteState.t()}}
          | {:error, term()}
  def apply(%Community{} = community, %ArticleBranch{} = branch, tree, items_by_target)
      when is_map(tree) and is_map(items_by_target) do
    with {:ok, state} <- Read.ensure_draft_state(community, branch_id: branch.id),
         {:ok, attrs} <-
           flatten_tabs(community, branch, Map.get(tree, "tabs", []), items_by_target),
         {:ok, nodes} <- upsert_nodes(attrs),
         {:ok, state} <- Revision.bump_tree_draft(community, state) do
      {:ok, %{nodes: nodes, state: state}}
    end
  end

  defp flatten_tabs(community, branch, tabs, items_by_target) when is_list(tabs) do
    tabs
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn {tab, index}, {:ok, attrs} ->
      tab_id = node_id(:tab, tab["sourceId"])

      with {:ok, attrs} <-
             flatten_groups(
               community,
               branch,
               tab_id,
               Map.get(tab, "groups", []),
               items_by_target,
               [base_attrs(community, branch, tab, :tab, tab_id, index) | attrs]
             ),
           {:ok, attrs} <-
             flatten_pins(
               community,
               branch,
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

  defp flatten_tabs(_community, _branch, _tabs, _items_by_target),
    do: {:error, {:custom, "imported Doc tree tabs are invalid"}}

  defp flatten_groups(community, branch, tab_id, groups, items_by_target, attrs)
       when is_list(groups) do
    groups
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, attrs}, fn {group, index}, {:ok, attrs} ->
      group_id = node_id(:group, group["sourceId"])

      group_attrs =
        community
        |> base_attrs(branch, group, :group, group_id, index)
        |> Map.put(:tab_id, tab_id)

      with {:ok, attrs} <-
             flatten_children(
               community,
               branch,
               group_id,
               Map.get(group, "children", []),
               items_by_target,
               [group_attrs | attrs]
             ) do
        {:cont, {:ok, attrs}}
      else
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp flatten_groups(_community, _branch, _tab_id, _groups, _items_by_target, _attrs),
    do: {:error, {:custom, "imported Doc tree groups are invalid"}}

  defp flatten_children(community, branch, group_id, children, items_by_target, attrs)
       when is_list(children) do
    children
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, attrs}, fn {child, index}, {:ok, attrs} ->
      case child["type"] do
        "page" ->
          target_ref = child["docId"]

          if Map.has_key?(items_by_target, target_ref) do
            child_attrs =
              community
              |> base_attrs(branch, child, :page, node_id(:page, child["sourceId"]), index)
              |> Map.put(:group_id, group_id)
              |> Map.put(:doc_id, target_ref)

            {:cont, {:ok, [child_attrs | attrs]}}
          else
            {:cont, {:ok, attrs}}
          end

        "link" ->
          child_attrs =
            community
            |> base_attrs(branch, child, :link, node_id(:link, child["sourceId"]), index)
            |> Map.put(:group_id, group_id)
            |> Map.put(:href, child["href"])

          {:cont, {:ok, [child_attrs | attrs]}}

        _ ->
          {:halt, {:error, {:custom, "imported Doc tree child type is invalid"}}}
      end
    end)
  end

  defp flatten_children(_community, _branch, _group_id, _children, _items_by_target, _attrs),
    do: {:error, {:custom, "imported Doc tree children are invalid"}}

  defp flatten_pins(community, branch, tab_id, pins, attrs) when is_list(pins) do
    pins
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, attrs}, fn {pin, index}, {:ok, attrs} ->
      pin_attrs =
        community
        |> base_attrs(branch, pin, :pin, node_id(:pin, pin["sourceId"]), index)
        |> Map.put(:tab_id, tab_id)
        |> Map.put(:href, pin["href"])

      {:cont, {:ok, [pin_attrs | attrs]}}
    end)
  end

  defp flatten_pins(_community, _branch, _tab_id, _pins, _attrs),
    do: {:error, {:custom, "imported Doc tree pins are invalid"}}

  defp base_attrs(%Community{} = community, branch, source, type, source_node_id, index) do
    %{
      community_id: community.id,
      branch_id: branch.id,
      node_id: source_node_id,
      stage: CMS.Const.stage(:draft),
      type: type,
      title: source["title"],
      slug: source["slug"],
      index: index
    }
  end

  defp upsert_nodes([]), do: {:ok, []}

  defp upsert_nodes(attrs) do
    # Keep the projection linear and the database cost proportional to batch
    # count rather than node count:
    #
    #     N ordered attrs --> validate --> last-wins dedupe --> ceil(N / 500) SQL
    #
    # Returned rows are indexed by stable node_id and then expanded back to the
    # source order, including repeated source identities expected by callers.
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    with {:ok, rows} <- validated_rows(attrs, now) do
      nodes =
        rows
        |> dedupe_last_rows()
        |> Enum.chunk_every(@insert_batch_size)
        |> Enum.flat_map(fn batch ->
          {_count, nodes} =
            Repo.insert_all(DocTreeNode, batch,
              on_conflict: {:replace, @managed_fields},
              conflict_target: [:community_id, :branch_id, :stage, :node_id],
              returning: true
            )

          nodes
        end)

      nodes_by_id = Map.new(nodes, &{&1.node_id, &1})
      {:ok, Enum.map(attrs, &Map.fetch!(nodes_by_id, &1.node_id))}
    end
  end

  defp validated_rows(attrs, now) do
    Enum.reduce_while(attrs, {:ok, []}, fn attrs, {:ok, rows} ->
      attrs = Map.merge(%{tab_id: nil, group_id: nil, doc_id: nil, href: nil}, attrs)
      changeset = DocTreeNode.changeset(%DocTreeNode{}, attrs)

      case Ecto.Changeset.apply_action(changeset, :insert) do
        {:ok, _node} ->
          row = attrs |> Map.put(:inserted_at, now) |> Map.put(:updated_at, now)
          {:cont, {:ok, [row | rows]}}

        {:error, changeset} ->
          {:halt, {:error, changeset}}
      end
    end)
    |> case do
      {:ok, rows} -> {:ok, Enum.reverse(rows)}
      error -> error
    end
  end

  defp reverse_attrs({:ok, attrs}), do: {:ok, Enum.reverse(attrs)}
  defp reverse_attrs(error), do: error

  defp dedupe_last_rows(rows) do
    rows
    |> Enum.reverse()
    |> Enum.uniq_by(& &1.node_id)
    |> Enum.reverse()
  end

  defp node_id(type, source_id) when is_binary(source_id) and source_id != "" do
    hash = Canonical.sha256(%{type: Atom.to_string(type), source_id: source_id})
    "import:#{Atom.to_string(type)}:" <> String.slice(hash, 0, 48)
  end

  defp node_id(type, source_id), do: node_id(type, inspect(source_id))
end
