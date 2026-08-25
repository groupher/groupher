defmodule GroupherServer.CMS.DocTree.Events do
  require GroupherServer.CMS.DocTree.Const
  @moduledoc """
  Event log for Tree staged changes.

      user tree action                         new docs page
            |
            v
      materialized draft rows  +  doc_tree_events(owner=tree, status=staged)
            |                                |
            | publish tree                   | diff/revert UI
            v                                v
      doc_tree_snapshots            human-readable Tree changes

      doc_tree_events(owner=doc, doc_id=draft.doc_id)
            |
            | publish doc
            v
      public page node + published doc event

  Events are intentionally domain-level. They are not a raw JSON patch; each one
  can be rendered, reviewed, and eventually reverted with its inverse payload.

  Business position:

      Dashboard / public Docs
        -> CMS.DocTree
        -> Events
        -> Repo / published projection
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.CMS.Docs.Branch
  alias GroupherServer.CMS.DocTree.Snapshot
  alias GroupherServer.CMS.Model.{Community, DocTreeEvent, DocTreeNode, DocTreeSnapshot}
  alias Helper.{ORM, T}


  @tree_fields ~w(title marker badge hidden href)a
  @doc_tree_json_key_node CMS.DocTree.Const.doc_tree_json_key(:node)
  @doc_tree_json_key_id CMS.DocTree.Const.doc_tree_json_key(:id)
  @doc_tree_json_key_type CMS.DocTree.Const.doc_tree_json_key(:type)
  @doc_tree_json_key_doc_id CMS.DocTree.Const.doc_tree_json_key(:doc_id)
  @tree_node_type_group CMS.DocTree.Const.tree_node_type(:group)
  @tree_node_type_page CMS.DocTree.Const.tree_node_type(:page)
  @tree_node_type_pin CMS.DocTree.Const.tree_node_type(:pin)

  @doc """
  Records one staged Tree event.

  ## Examples

      iex> Events.record_staged(community, "node.rename", payload, inverse)
      {:ok, %DocTreeEvent{owner: CMS.DocTree.Const.tree_event_owner(:tree)}}

      iex> Events.record_staged(community, "node.create", payload, inverse, user.id, owner: CMS.DocTree.Const.tree_event_owner(:doc), doc_id: draft.doc_id)
      {:ok, %DocTreeEvent{owner: CMS.DocTree.Const.tree_event_owner(:doc)}}
  """
  @spec record_staged(Community.t(), String.t(), map(), map(), integer() | nil, keyword()) ::
          T.domain_res(DocTreeEvent.t())
  def record_staged(
        %Community{} = community,
        event_type,
        payload,
        inverse_payload,
        author_id \\ nil,
        opts \\ []
      ) do
    Repo.transaction(fn ->
      with {:ok, branch} <- Branch.resolve(community, opts),
           {:ok, _community} <- ORM.lock_community(community),
           {:ok, event} <-
             insert_staged_event(
               community,
               branch,
               event_type,
               payload,
               inverse_payload,
               author_id,
               opts,
               next_seq(community, branch)
             ) do
        event
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
    |> transaction_result()
  end

  defp insert_staged_event(
         community,
         branch,
         event_type,
         payload,
         inverse_payload,
         author_id,
         opts,
         seq
       ) do
    attrs =
      %{
        community_id: community.id,
        branch_id: branch.id,
        seq: seq,
        event_type: event_type,
        payload: payload,
        inverse_payload: inverse_payload,
        status: CMS.DocTree.Const.tree_event_status(:staged),
        owner: Keyword.get(opts, :owner, :tree),
        author_id: author_id
      }
      |> Map.merge(event_selectors(payload, opts))

    ORM.create(DocTreeEvent, attrs)
  end

  @doc """
  Records a list of staged Tree events.

  ## Examples

      iex> Events.record_staged_many(community, [%{type: "node.rename", payload: %{}, inverse: %{}}])
      {:ok, [%DocTreeEvent{owner: CMS.DocTree.Const.tree_event_owner(:tree)}]}
  """
  @spec record_staged_many(Community.t(), list(map()), integer() | nil, keyword()) ::
          T.domain_res(list(DocTreeEvent.t()))
  def record_staged_many(community, events, author_id \\ nil, opts \\ [])

  def record_staged_many(%Community{}, [], _author_id, _opts), do: {:ok, []}

  def record_staged_many(%Community{} = community, events, author_id, opts) do
    Repo.transaction(fn ->
      with {:ok, branch} <- Branch.resolve(community, opts),
           {:ok, _community} <- ORM.lock_community(community) do
        next_seq = next_seq(community, branch)

        events
        |> Enum.with_index()
        |> Enum.reduce_while({:ok, []}, fn {%{type: type, payload: payload, inverse: inverse} =
                                              attrs, index},
                                           {:ok, acc} ->
          opts =
            attrs
            |> Map.take([:owner, :doc_id])
            |> Enum.into([])
            |> Keyword.merge(branch_id: branch.id)

          record_staged_event(
            community,
            branch,
            %{
              type: type,
              payload: payload,
              inverse: inverse,
              author_id: author_id,
              opts: opts,
              seq: next_seq + index
            },
            acc
          )
        end)
        |> case do
          {:ok, events} -> Enum.reverse(events)
          {:error, reason} -> Repo.rollback(reason)
        end
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
    |> transaction_result()
  end

  defp record_staged_event(community, branch, event_attrs, acc) do
    %{type: type, payload: payload, inverse: inverse, author_id: author_id, opts: opts, seq: seq} =
      event_attrs

    case insert_staged_event(community, branch, type, payload, inverse, author_id, opts, seq) do
      {:ok, event} -> {:cont, {:ok, [event | acc]}}
      error -> {:halt, error}
    end
  end

  @doc """
  Returns staged events in user-action order.
  """
  @spec staged_events(Community.t(), keyword()) :: list(DocTreeEvent.t())
  def staged_events(%Community{} = community, opts \\ []) do
    owner = Keyword.get(opts, :owner)
    {:ok, branch} = Branch.resolve(community, opts)

    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.branch_id == ^branch.id)
    |> where([e], e.status == CMS.DocTree.Const.tree_event_status(:staged))
    |> maybe_filter_owner(owner)
    |> order_by([e], asc: e.seq, asc: e.id)
    |> Repo.all()
  end

  @doc """
  Counts staged Tree-owned events that should drive the Tree SavingBar.

  ## Examples

      iex> Events.staged_tree_event_count(community)
      2
  """
  @spec staged_tree_event_count(Community.t(), keyword()) :: non_neg_integer()
  def staged_tree_event_count(%Community{} = community, opts \\ []) do
    {:ok, branch} = Branch.resolve(community, opts)

    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.branch_id == ^branch.id)
    |> where([e], e.status == CMS.DocTree.Const.tree_event_status(:staged))
    |> where([e], e.owner == CMS.DocTree.Const.tree_event_owner(:tree))
    |> Repo.aggregate(:count, :id)
  end

  @doc """
  Builds domain events for a node patch by comparing the before/after node.
  """
  @spec update_events(DocTreeNode.t(), DocTreeNode.t()) :: list(map())
  def update_events(%DocTreeNode{} = before, %DocTreeNode{} = after_node) do
    @tree_fields
    |> Enum.flat_map(fn field ->
      before_value = Map.get(before, field)
      after_value = Map.get(after_node, field)

      if before_value == after_value do
        []
      else
        [field_update_event(before, after_node, field, before_value, after_value)]
      end
    end)
  end

  @doc """
  Builds a create event for a new group/page/link node.
  """
  @spec create_event(DocTreeNode.t()) :: map()
  def create_event(%DocTreeNode{} = node) do
    node_payload = node_payload(node)

    %{
      type: node_event_type(node, :create),
      payload: %{@doc_tree_json_key_node => node_payload},
      inverse: %{"nodeId" => node_payload[@doc_tree_json_key_id]}
    }
  end

  @doc """
  Builds a delete event for a removed group/page/link node.
  """
  @spec delete_event(DocTreeNode.t(), list(DocTreeNode.t())) :: map()
  def delete_event(%DocTreeNode{} = node, subtree \\ []) do
    node_payload = node_payload(node)

    children_payload =
      subtree
      |> Enum.reject(&(&1.node_id == node.node_id))
      |> Enum.map(&node_payload/1)

    %{
      type: node_event_type(node, :delete),
      payload: %{@doc_tree_json_key_node => node_payload},
      inverse: %{@doc_tree_json_key_node => node_payload, "pages" => children_payload}
    }
  end

  @doc """
  Builds a move event for one node.
  """
  @spec move_event(
          DocTreeNode.t(),
          Ecto.UUID.t() | nil,
          integer(),
          Ecto.UUID.t() | nil,
          integer()
        ) ::
          map()
  def move_event(
        %DocTreeNode{} = node,
        before_parent_id,
        before_index,
        after_parent_id,
        after_index
      ) do
    %{
      type: node_event_type(node, :move),
      payload: %{
        "nodeId" => node.node_id,
        "nodeType" => to_string(node.type),
        "docId" => node.doc_id,
        "title" => node.title,
        "beforeParentNodeId" => before_parent_id,
        "afterParentNodeId" => after_parent_id,
        "beforeIndex" => before_index,
        "afterIndex" => after_index
      },
      inverse: %{
        "nodeId" => node.node_id,
        "targetParentNodeId" => before_parent_id,
        "targetIndex" => before_index
      }
    }
  end

  @doc """
  Marks staged Tree-owned events as published by the given Tree snapshot.
  """
  @spec mark_staged_published(Community.t(), DocTreeSnapshot.t()) :: non_neg_integer()
  def mark_staged_published(%Community{} = community, %DocTreeSnapshot{} = snapshot) do
    {count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.branch_id == ^snapshot.branch_id)
      |> where([e], e.status == CMS.DocTree.Const.tree_event_status(:staged))
      |> where([e], e.owner == CMS.DocTree.Const.tree_event_owner(:tree))
      |> Repo.update_all(
        set: [
          status: CMS.DocTree.Const.tree_event_status(:published),
          snapshot_id: snapshot.id,
          updated_at: DateTime.utc_now(:second)
        ]
      )

    count
  end

  @doc """
  Marks selected staged Tree-owned events as published by the given Tree snapshot.

  Unified publish can publish a subset of the pending checklist. In that path we
  must not archive every staged Tree event, otherwise unchecked items disappear
  from the next `publishChecklist`.

  ## Examples

      iex> Events.mark_tree_events_published(community, snapshot, [1, 2])
      2
  """
  @spec mark_tree_events_published(Community.t(), DocTreeSnapshot.t(), list(T.id())) ::
          non_neg_integer()
  def mark_tree_events_published(%Community{} = community, %DocTreeSnapshot{} = snapshot, ids) do
    ids = Enum.flat_map(ids, &event_id/1)

    {count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.branch_id == ^snapshot.branch_id)
      |> where([e], e.status == CMS.DocTree.Const.tree_event_status(:staged))
      |> where([e], e.owner == CMS.DocTree.Const.tree_event_owner(:tree))
      |> where([e], e.id in ^ids)
      |> Repo.update_all(
        set: [
          status: CMS.DocTree.Const.tree_event_status(:published),
          snapshot_id: snapshot.id,
          updated_at: DateTime.utc_now(:second)
        ]
      )

    count
  end

  defp event_id(id) when is_integer(id), do: [id]

  defp event_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {id, ""} -> [id]
      _ -> []
    end
  end

  defp event_id(_), do: []

  @doc """
  Marks doc-bound events for one article draft as published.

  The article publish flow owns these events, so they intentionally do not get a
  `snapshot_id` from Tree publish. Legacy tree-owned page create events are
  included so page creation stays an atomic docs publish operation.

  ## Examples

      iex> Events.mark_doc_bound_published(community, draft.doc_id)
      1
  """
  @spec mark_doc_bound_published(Community.t(), String.t(), keyword()) :: non_neg_integer()
  def mark_doc_bound_published(%Community{} = community, doc_id, opts \\ []) do
    {:ok, branch} = Branch.resolve(community, opts)

    {count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.branch_id == ^branch.id)
      |> where([e], e.status == CMS.DocTree.Const.tree_event_status(:staged))
      |> where([e], e.owner == CMS.DocTree.Const.tree_event_owner(:doc))
      |> where([e], e.doc_id == ^doc_id)
      |> Repo.update_all(
        set: [
          status: CMS.DocTree.Const.tree_event_status(:published),
          updated_at: DateTime.utc_now(:second)
        ]
      )

    {tree_page_create_count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.branch_id == ^branch.id)
      |> where([e], e.status == CMS.DocTree.Const.tree_event_status(:staged))
      |> where([e], e.owner == CMS.DocTree.Const.tree_event_owner(:tree))
      |> where([e], e.event_type == CMS.DocTree.Const.tree_event(:node_create))
      |> where([e], e.node_type == ^@tree_node_type_page)
      |> where([e], e.doc_id == ^doc_id)
      |> Repo.update_all(
        set: [
          status: CMS.DocTree.Const.tree_event_status(:published),
          updated_at: DateTime.utc_now(:second)
        ]
      )

    count + tree_page_create_count
  end

  @doc """
  Marks staged Tree-owned create events for nodes that were published as part of
  doc publishing, such as auto-created parent groups.
  """
  @spec mark_tree_create_published(Community.t(), list(String.t()), keyword()) ::
          non_neg_integer()
  def mark_tree_create_published(community, node_ids, opts \\ [])

  def mark_tree_create_published(_community, [], _opts), do: 0

  def mark_tree_create_published(%Community{} = community, node_ids, opts) do
    {:ok, branch} = Branch.resolve(community, opts)
    node_ids = Enum.map(node_ids, &to_string/1)

    {count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.branch_id == ^branch.id)
      |> where([e], e.status == CMS.DocTree.Const.tree_event_status(:staged))
      |> where([e], e.owner == CMS.DocTree.Const.tree_event_owner(:tree))
      |> where([e], e.event_type == CMS.DocTree.Const.tree_event(:node_create))
      |> where([e], e.node_id in ^node_ids)
      |> Repo.update_all(
        set: [
          status: CMS.DocTree.Const.tree_event_status(:published),
          updated_at: DateTime.utc_now(:second)
        ]
      )

    count
  end

  @doc """
  Discards staged doc-bound events for docs that were removed from the draft
  tree before they were published.
  """
  @spec discard_doc_bound_staged(Community.t(), list(String.t()), keyword()) :: non_neg_integer()
  def discard_doc_bound_staged(community, doc_ids, opts \\ [])

  def discard_doc_bound_staged(_community, [], _opts), do: 0

  def discard_doc_bound_staged(%Community{} = community, doc_ids, opts) do
    {:ok, branch} = Branch.resolve(community, opts)
    doc_ids = Enum.map(doc_ids, &to_string/1)

    {count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.branch_id == ^branch.id)
      |> where([e], e.status == CMS.DocTree.Const.tree_event_status(:staged))
      |> where([e], e.owner == CMS.DocTree.Const.tree_event_owner(:doc))
      |> where([e], e.doc_id in ^doc_ids)
      |> Repo.update_all(
        set: [
          status: CMS.DocTree.Const.tree_event_status(:discarded),
          updated_at: DateTime.utc_now(:second)
        ]
      )

    {tree_page_create_count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.branch_id == ^branch.id)
      |> where([e], e.status == CMS.DocTree.Const.tree_event_status(:staged))
      |> where([e], e.owner == CMS.DocTree.Const.tree_event_owner(:tree))
      |> where([e], e.event_type == CMS.DocTree.Const.tree_event(:node_create))
      |> where([e], e.node_type == ^@tree_node_type_page)
      |> where([e], e.doc_id in ^doc_ids)
      |> Repo.update_all(
        set: [
          status: CMS.DocTree.Const.tree_event_status(:discarded),
          updated_at: DateTime.utc_now(:second)
        ]
      )

    count + tree_page_create_count
  end

  @doc """
  Discards staged Tree-owned create events for draft-only nodes that were removed
  before ever being published.
  """
  @spec discard_tree_create_staged(Community.t(), list(String.t()), keyword()) ::
          non_neg_integer()
  def discard_tree_create_staged(community, node_ids, opts \\ [])

  def discard_tree_create_staged(_community, [], _opts), do: 0

  def discard_tree_create_staged(%Community{} = community, node_ids, opts) do
    {:ok, branch} = Branch.resolve(community, opts)
    node_ids = Enum.map(node_ids, &to_string/1)

    {count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.branch_id == ^branch.id)
      |> where([e], e.status == CMS.DocTree.Const.tree_event_status(:staged))
      |> where([e], e.owner == CMS.DocTree.Const.tree_event_owner(:tree))
      |> where([e], e.event_type == CMS.DocTree.Const.tree_event(:node_create))
      |> where([e], e.node_id in ^node_ids)
      |> Repo.update_all(
        set: [
          status: CMS.DocTree.Const.tree_event_status(:discarded),
          updated_at: DateTime.utc_now(:second)
        ]
      )

    count
  end

  @doc "Discards every staged event owned by nodes/docs moved into product Trash."
  @spec discard_staged_for_trash(Community.t(), [String.t()], [String.t()], keyword()) ::
          non_neg_integer()
  def discard_staged_for_trash(%Community{} = community, node_ids, doc_ids, opts \\ []) do
    {:ok, branch} = Branch.resolve(community, opts)
    node_ids = Enum.map(node_ids, &to_string/1)
    doc_ids = Enum.map(doc_ids, &to_string/1)

    base =
      DocTreeEvent
      |> where([event], event.community_id == ^community.id)
      |> where([event], event.branch_id == ^branch.id)
      |> where([event], event.status == CMS.DocTree.Const.tree_event_status(:staged))
      |> where(
        [event],
        event.node_id in ^node_ids or (not is_nil(event.doc_id) and event.doc_id in ^doc_ids)
      )

    tree_count =
      base
      |> where([event], event.owner == CMS.DocTree.Const.tree_event_owner(:tree))
      |> Repo.aggregate(:count, :id)

    base
    |> Repo.update_all(
      set: [
        status: CMS.DocTree.Const.tree_event_status(:discarded),
        updated_at: DateTime.utc_now(:second)
      ]
    )

    tree_count
  end

  @doc """
  Creates a Tree snapshot from canonical JSON and archives events.

  When `:event_ids` is omitted, all staged tree-owned events are archived. When
  it is provided, only those staged events are marked published.

  ## Examples

      iex> Events.publish_snapshot(community, user.id, "rename")
      {:ok, %DocTreeSnapshot{}}

      iex> Events.publish_snapshot(community, user.id, "selected", event_ids: [1])
      {:ok, %DocTreeSnapshot{}}
  """
  @spec publish_snapshot(Community.t(), integer() | nil, String.t() | nil, keyword()) ::
          T.domain_res(DocTreeSnapshot.t())
  def publish_snapshot(%Community{} = community, author_id \\ nil, message \\ nil, opts \\ []) do
    with {:ok, branch} <- Branch.resolve(community, opts) do
      do_publish_snapshot(community, branch, author_id, message, opts)
    end
  end

  defp do_publish_snapshot(%Community{} = community, branch, author_id, message, opts) do
    tree_json =
      Keyword.get(opts, :tree_json) || Snapshot.draft_json(community, branch_id: branch.id)

    event_ids = Keyword.get(opts, :event_ids)

    with {:ok, snapshot} <-
           ORM.create(DocTreeSnapshot, %{
             community_id: community.id,
             branch_id: branch.id,
             tree_json: tree_json,
             tree_hash: Snapshot.hash(tree_json),
             author_id: author_id,
             message: message,
             published_at: DateTime.utc_now(:second)
           }) do
      if is_list(event_ids) do
        mark_tree_events_published(community, snapshot, event_ids)
      else
        mark_staged_published(community, snapshot)
      end

      {:ok, snapshot}
    end
  end

  defp field_update_event(
         %DocTreeNode{type: @tree_node_type_group} = before,
         after_node,
         :title,
         before_value,
         after_value
       ) do
    field_update_event(
      before,
      after_node,
      "title",
      CMS.DocTree.Const.tree_event(:group_rename),
      before_value,
      after_value
    )
  end

  defp field_update_event(before, after_node, :title, before_value, after_value) do
    field_update_event(
      before,
      after_node,
      "title",
      update_event_type(before, CMS.DocTree.Const.tree_event(:node_rename)),
      before_value,
      after_value
    )
  end

  defp field_update_event(before, after_node, :marker, before_value, after_value) do
    field_update_event(
      before,
      after_node,
      "marker",
      update_event_type(before, CMS.DocTree.Const.tree_event(:node_marker_update)),
      before_value,
      after_value
    )
  end

  defp field_update_event(before, after_node, :href, before_value, after_value) do
    field_update_event(
      before,
      after_node,
      "href",
      update_event_type(before, CMS.DocTree.Const.tree_event(:link_href_update)),
      before_value,
      after_value
    )
  end

  defp field_update_event(before, after_node, field, before_value, after_value) do
    field_name = Atom.to_string(field)

    field_update_event(
      before,
      after_node,
      field_name,
      update_event_type(before, CMS.DocTree.Const.tree_event(:node_update)),
      before_value,
      after_value
    )
  end

  defp field_update_event(before, after_node, field, type, before_value, after_value) do
    %{
      type: type,
      payload: base_field_payload(before, field, before_value, after_value),
      inverse: inverse_field_payload(after_node, field, before_value)
    }
  end

  defp node_event_type(%DocTreeNode{type: @tree_node_type_pin}, :create),
    do: CMS.DocTree.Const.tree_event(:pin_add)

  defp node_event_type(%DocTreeNode{type: @tree_node_type_pin}, :delete),
    do: CMS.DocTree.Const.tree_event(:pin_remove)

  defp node_event_type(%DocTreeNode{type: @tree_node_type_pin}, :move),
    do: CMS.DocTree.Const.tree_event(:pin_reorder)

  defp node_event_type(%DocTreeNode{}, :create), do: CMS.DocTree.Const.tree_event(:node_create)
  defp node_event_type(%DocTreeNode{}, :delete), do: CMS.DocTree.Const.tree_event(:node_delete)
  defp node_event_type(%DocTreeNode{}, :move), do: CMS.DocTree.Const.tree_event(:node_move)

  defp update_event_type(%DocTreeNode{type: @tree_node_type_pin}, _fallback),
    do: CMS.DocTree.Const.tree_event(:pin_update)

  defp update_event_type(%DocTreeNode{}, fallback), do: fallback

  defp base_field_payload(node, field, before_value, after_value) do
    %{
      "nodeId" => node.node_id,
      "nodeType" => to_string(node.type),
      "docId" => node.doc_id,
      "title" => node.title,
      "field" => field,
      "before" => before_value,
      "after" => after_value
    }
  end

  defp inverse_field_payload(node, field, value) do
    %{
      "nodeId" => node.node_id,
      "field" => field,
      "value" => value
    }
  end

  defp node_payload(%DocTreeNode{} = node) do
    Snapshot.node_json(node)
    |> Map.merge(%{
      "parentNodeId" => node.parent_node_id,
      "index" => node.index
    })
  end

  # Event payloads have two stable shapes:
  # - create/delete keep the full node snapshot under "node";
  # - move/update keep only flat selector fields plus the field diff.
  # Keep selector extraction explicit so SQL-facing columns do not depend on
  # ad-hoc JSON traversal rules.
  defp event_selectors(%{@doc_tree_json_key_node => node}, opts) when is_map(node) do
    selector_attrs(
      Map.get(node, @doc_tree_json_key_id),
      Map.get(node, @doc_tree_json_key_type),
      Keyword.get(opts, :doc_id) || Map.get(node, @doc_tree_json_key_doc_id)
    )
  end

  defp event_selectors(%{"nodeId" => node_id} = payload, opts) do
    selector_attrs(
      node_id,
      Map.get(payload, "nodeType"),
      Keyword.get(opts, :doc_id) || Map.get(payload, "docId")
    )
  end

  defp event_selectors(payload, opts) when is_map(payload) do
    selector_attrs(nil, nil, Keyword.get(opts, :doc_id) || Map.get(payload, "docId"))
  end

  defp selector_attrs(node_id, node_type, doc_id) do
    %{
      doc_id: doc_id,
      node_id: node_id,
      node_type: normalize_node_type(node_type)
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp normalize_node_type(type) when is_atom(type) do
    if type in CMS.DocTree.Const.tree_node_type_values(), do: type, else: nil
  end

  defp normalize_node_type(type) when is_binary(type) do
    Enum.find(CMS.DocTree.Const.tree_node_type_values(), &(to_string(&1) == type))
  end

  defp normalize_node_type(_), do: nil

  defp transaction_result({:ok, result}), do: {:ok, result}
  defp transaction_result({:error, reason}), do: {:error, reason}

  defp next_seq(%Community{} = community, branch) do
    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.branch_id == ^branch.id)
    |> select([e], max(e.seq))
    |> Repo.one()
    |> case do
      nil -> 1
      seq -> seq + 1
    end
  end

  defp maybe_filter_owner(query, nil), do: query
  defp maybe_filter_owner(query, owner), do: where(query, [e], e.owner == ^owner)
end
