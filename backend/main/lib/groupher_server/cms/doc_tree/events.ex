defmodule GroupherServer.CMS.DocTree.Events do
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
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.Snapshot
  alias CMS.Model.{Community, DocTreeEvent, DocTreeNode, DocTreeSnapshot}
  alias Helper.{ORM, T}

  require CMS.Const

  @tree_fields ~w(title slug marker badge hidden href ui_config)a

  @doc """
  Records one staged Tree event.

  ## Examples

      iex> Events.record_staged(community, "node.rename", payload, inverse)
      {:ok, %DocTreeEvent{owner: CMS.Const.doc_tree_action_owner(:tree)}}

      iex> Events.record_staged(community, "node.create", payload, inverse, user.id, owner: CMS.Const.doc_tree_action_owner(:doc), doc_id: draft.doc_id)
      {:ok, %DocTreeEvent{owner: CMS.Const.doc_tree_action_owner(:doc)}}
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
    ORM.create(DocTreeEvent, %{
      community_id: community.id,
      seq: next_seq(community),
      event_type: event_type,
      payload: payload,
      inverse_payload: inverse_payload,
      status: CMS.Const.doc_tree_event_status(:staged),
      owner: Keyword.get(opts, :owner, :tree),
      doc_id: Keyword.get(opts, :doc_id),
      author_id: author_id
    })
  end

  @doc """
  Records a list of staged Tree events.

  ## Examples

      iex> Events.record_staged_many(community, [%{type: "node.rename", payload: %{}, inverse: %{}}])
      {:ok, [%DocTreeEvent{owner: CMS.Const.doc_tree_action_owner(:tree)}]}
  """
  @spec record_staged_many(Community.t(), list(map()), integer() | nil) ::
          T.domain_res(list(DocTreeEvent.t()))
  def record_staged_many(%Community{} = community, events, author_id \\ nil) do
    events
    |> Enum.reduce_while({:ok, []}, fn %{type: type, payload: payload, inverse: inverse} = attrs,
                                       {:ok, acc} ->
      opts =
        attrs
        |> Map.take([:owner, :doc_id])
        |> Enum.into([])

      case record_staged(community, type, payload, inverse, author_id, opts) do
        {:ok, event} -> {:cont, {:ok, [event | acc]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, events} -> {:ok, Enum.reverse(events)}
      error -> error
    end
  end

  @doc """
  Returns staged events in user-action order.
  """
  @spec staged_events(Community.t(), keyword()) :: list(DocTreeEvent.t())
  def staged_events(%Community{} = community, opts \\ []) do
    owner = Keyword.get(opts, :owner)

    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.status == CMS.Const.doc_tree_event_status(:staged))
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
  @spec staged_tree_event_count(Community.t()) :: non_neg_integer()
  def staged_tree_event_count(%Community{} = community) do
    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.status == CMS.Const.doc_tree_event_status(:staged))
    |> where([e], e.owner == CMS.Const.doc_tree_action_owner(:tree))
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
      type: CMS.Const.doc_tree_action(:node_create),
      payload: %{"node" => node_payload},
      inverse: %{"nodeId" => node_payload["id"]}
    }
  end

  @doc """
  Builds a delete event for a removed group/page/link node.
  """
  @spec delete_event(DocTreeNode.t()) :: map()
  def delete_event(%DocTreeNode{} = node) do
    node_payload = node_payload(node)

    %{
      type: CMS.Const.doc_tree_action(:node_delete),
      payload: %{"node" => node_payload},
      inverse: %{"node" => node_payload}
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
        before_group_id,
        before_index,
        after_group_id,
        after_index
      ) do
    %{
      type: CMS.Const.doc_tree_action(:node_move),
      payload: %{
        "nodeId" => node.node_id,
        "title" => node.title,
        "beforeGroupId" => before_group_id,
        "afterGroupId" => after_group_id,
        "beforeIndex" => before_index,
        "afterIndex" => after_index
      },
      inverse: %{
        "nodeId" => node.node_id,
        "targetGroupId" => before_group_id,
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
      |> where([e], e.status == CMS.Const.doc_tree_event_status(:staged))
      |> where([e], e.owner == CMS.Const.doc_tree_action_owner(:tree))
      |> Repo.update_all(
        set: [
          status: CMS.Const.doc_tree_event_status(:published),
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
  from the next `publishScope`.

  ## Examples

      iex> Events.mark_tree_events_published(community, snapshot, [1, 2])
      2
  """
  @spec mark_tree_events_published(Community.t(), DocTreeSnapshot.t(), list(T.id())) ::
          non_neg_integer()
  def mark_tree_events_published(%Community{} = community, %DocTreeSnapshot{} = snapshot, ids) do
    ids = Enum.map(ids, &to_string/1)

    {count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.status == CMS.Const.doc_tree_event_status(:staged))
      |> where([e], e.owner == CMS.Const.doc_tree_action_owner(:tree))
      |> where([e], fragment("?::text", e.id) in ^ids)
      |> Repo.update_all(
        set: [
          status: CMS.Const.doc_tree_event_status(:published),
          snapshot_id: snapshot.id,
          updated_at: DateTime.utc_now(:second)
        ]
      )

    count
  end

  @doc """
  Marks doc-bound events for one article draft as published.

  The article publish flow owns these events, so they intentionally do not get a
  `snapshot_id` from Tree publish. Legacy tree-owned page create events are
  included so page creation stays an atomic docs publish operation.

  ## Examples

      iex> Events.mark_doc_bound_published(community, draft.doc_id)
      1
  """
  @spec mark_doc_bound_published(Community.t(), String.t()) :: non_neg_integer()
  def mark_doc_bound_published(%Community{} = community, doc_id) do
    {count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.status == CMS.Const.doc_tree_event_status(:staged))
      |> where([e], e.owner == CMS.Const.doc_tree_action_owner(:doc))
      |> where([e], e.doc_id == ^doc_id)
      |> Repo.update_all(
        set: [
          status: CMS.Const.doc_tree_event_status(:published),
          updated_at: DateTime.utc_now(:second)
        ]
      )

    {legacy_count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.status == CMS.Const.doc_tree_event_status(:staged))
      |> where([e], e.owner == CMS.Const.doc_tree_action_owner(:tree))
      |> where([e], e.event_type == CMS.Const.doc_tree_action(:node_create))
      |> where([e], fragment("?->'node'->>'type'", e.payload) == "page")
      |> where(
        [e],
        fragment("?->'node'->>'docId'", e.payload) == ^doc_id
      )
      |> Repo.update_all(
        set: [
          status: CMS.Const.doc_tree_event_status(:published),
          updated_at: DateTime.utc_now(:second)
        ]
      )

    count + legacy_count
  end

  @doc """
  Marks staged Tree-owned create events for nodes that were published as part of
  doc publishing, such as auto-created parent groups.
  """
  @spec mark_tree_create_published(Community.t(), list(String.t())) :: non_neg_integer()
  def mark_tree_create_published(_community, []), do: 0

  def mark_tree_create_published(%Community{} = community, node_ids) do
    node_ids = Enum.map(node_ids, &to_string/1)

    {count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.status == CMS.Const.doc_tree_event_status(:staged))
      |> where([e], e.owner == CMS.Const.doc_tree_action_owner(:tree))
      |> where([e], e.event_type == CMS.Const.doc_tree_action(:node_create))
      |> where([e], fragment("?->'node'->>'id'", e.payload) in ^node_ids)
      |> Repo.update_all(
        set: [
          status: CMS.Const.doc_tree_event_status(:published),
          updated_at: DateTime.utc_now(:second)
        ]
      )

    count
  end

  @doc """
  Discards staged doc-bound events for docs that were removed from the draft
  tree before they were published.
  """
  @spec discard_doc_bound_staged(Community.t(), list(String.t())) :: non_neg_integer()
  def discard_doc_bound_staged(_community, []), do: 0

  def discard_doc_bound_staged(%Community{} = community, doc_ids) do
    doc_ids = Enum.map(doc_ids, &to_string/1)

    {count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.status == CMS.Const.doc_tree_event_status(:staged))
      |> where([e], e.owner == CMS.Const.doc_tree_action_owner(:doc))
      |> where([e], e.doc_id in ^doc_ids)
      |> Repo.update_all(
        set: [
          status: CMS.Const.doc_tree_event_status(:discarded),
          updated_at: DateTime.utc_now(:second)
        ]
      )

    {legacy_count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.status == CMS.Const.doc_tree_event_status(:staged))
      |> where([e], e.owner == CMS.Const.doc_tree_action_owner(:tree))
      |> where([e], e.event_type == CMS.Const.doc_tree_action(:node_create))
      |> where([e], fragment("?->'node'->>'type'", e.payload) == "page")
      |> where([e], fragment("?->'node'->>'docId'", e.payload) in ^doc_ids)
      |> Repo.update_all(
        set: [
          status: CMS.Const.doc_tree_event_status(:discarded),
          updated_at: DateTime.utc_now(:second)
        ]
      )

    count + legacy_count
  end

  @doc """
  Discards staged Tree-owned create events for draft-only nodes that were removed
  before ever being published.
  """
  @spec discard_tree_create_staged(Community.t(), list(String.t())) :: non_neg_integer()
  def discard_tree_create_staged(_community, []), do: 0

  def discard_tree_create_staged(%Community{} = community, node_ids) do
    node_ids = Enum.map(node_ids, &to_string/1)

    {count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.status == CMS.Const.doc_tree_event_status(:staged))
      |> where([e], e.owner == CMS.Const.doc_tree_action_owner(:tree))
      |> where([e], e.event_type == CMS.Const.doc_tree_action(:node_create))
      |> where([e], fragment("?->'node'->>'id'", e.payload) in ^node_ids)
      |> Repo.update_all(
        set: [
          status: CMS.Const.doc_tree_event_status(:discarded),
          updated_at: DateTime.utc_now(:second)
        ]
      )

    count
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
    tree_json = Keyword.get(opts, :tree_json) || Snapshot.draft_json(community)
    event_ids = Keyword.get(opts, :event_ids)

    with {:ok, snapshot} <-
           ORM.create(DocTreeSnapshot, %{
             community_id: community.id,
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

  defp field_update_event(before, after_node, :title, before_value, after_value) do
    type =
      if before.type == :group,
        do: CMS.Const.doc_tree_action(:group_rename),
        else: CMS.Const.doc_tree_action(:node_rename)

    %{
      type: type,
      payload: base_field_payload(before, "title", before_value, after_value),
      inverse: inverse_field_payload(after_node, "title", before_value)
    }
  end

  defp field_update_event(before, after_node, :marker, before_value, after_value) do
    %{
      type: CMS.Const.doc_tree_action(:node_marker_update),
      payload: base_field_payload(before, "marker", before_value, after_value),
      inverse: inverse_field_payload(after_node, "marker", before_value)
    }
  end

  defp field_update_event(before, after_node, :href, before_value, after_value) do
    %{
      type: CMS.Const.doc_tree_action(:link_href_update),
      payload: base_field_payload(before, "href", before_value, after_value),
      inverse: inverse_field_payload(after_node, "href", before_value)
    }
  end

  defp field_update_event(before, after_node, field, before_value, after_value) do
    field_name = Atom.to_string(field)

    %{
      type: CMS.Const.doc_tree_action(:node_update),
      payload: base_field_payload(before, field_name, before_value, after_value),
      inverse: inverse_field_payload(after_node, field_name, before_value)
    }
  end

  defp base_field_payload(node, field, before_value, after_value) do
    %{
      "nodeId" => node.node_id,
      "nodeType" => to_string(node.type),
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
      "groupId" => node.group_id,
      "index" => node.index
    })
  end

  defp next_seq(%Community{} = community) do
    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
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
