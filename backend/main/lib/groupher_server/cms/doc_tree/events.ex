defmodule GroupherServer.CMS.DocTree.Events do
  @moduledoc """
  Event log for Tree staged changes.

      user tree action
            |
            v
      materialized draft rows  +  doc_tree_events(status=staged)
            |                                |
            | publish tree                   | diff/revert UI
            v                                v
      doc_tree_revisions            human-readable Tree changes

  Events are intentionally domain-level. They are not a raw JSON patch; each one
  can be rendered, reviewed, and eventually reverted with its inverse payload.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.Snapshot
  alias CMS.Model.{Community, DocTreeEvent, DocTreeNodeDraft, DocTreeRevision}
  alias Helper.{ORM, T}

  @tree_fields ~w(title slug marker badge hidden href target_node_id ui_config)a

  @doc """
  Records one staged Tree event.
  """
  @spec record_staged(Community.t(), String.t(), map(), map(), integer() | nil) ::
          T.domain_res(DocTreeEvent.t())
  def record_staged(
        %Community{} = community,
        event_type,
        payload,
        inverse_payload,
        author_id \\ nil
      ) do
    ORM.create(DocTreeEvent, %{
      community_id: community.id,
      seq: next_seq(community),
      event_type: event_type,
      payload: payload,
      inverse_payload: inverse_payload,
      status: :staged,
      author_id: author_id
    })
  end

  @doc """
  Records a list of staged Tree events.
  """
  @spec record_staged_many(Community.t(), list(map()), integer() | nil) ::
          T.domain_res(list(DocTreeEvent.t()))
  def record_staged_many(%Community{} = community, events, author_id \\ nil) do
    events
    |> Enum.reduce_while({:ok, []}, fn %{type: type, payload: payload, inverse: inverse},
                                       {:ok, acc} ->
      case record_staged(community, type, payload, inverse, author_id) do
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
  @spec staged_events(Community.t()) :: list(DocTreeEvent.t())
  def staged_events(%Community{} = community) do
    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.status == :staged)
    |> order_by([e], asc: e.seq, asc: e.id)
    |> Repo.all()
  end

  @doc """
  Builds domain events for a node patch by comparing the before/after node.
  """
  @spec update_events(DocTreeNodeDraft.t(), DocTreeNodeDraft.t()) :: list(map())
  def update_events(%DocTreeNodeDraft{} = before, %DocTreeNodeDraft{} = after_node) do
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
  @spec create_event(DocTreeNodeDraft.t()) :: map()
  def create_event(%DocTreeNodeDraft{} = node) do
    node_payload = node_payload(node)

    %{
      type: "node.create",
      payload: %{"node" => node_payload},
      inverse: %{"nodeId" => node_payload["id"]}
    }
  end

  @doc """
  Builds a delete event for a removed group/page/link node.
  """
  @spec delete_event(DocTreeNodeDraft.t()) :: map()
  def delete_event(%DocTreeNodeDraft{} = node) do
    node_payload = node_payload(node)

    %{
      type: "node.delete",
      payload: %{"node" => node_payload},
      inverse: %{"node" => node_payload}
    }
  end

  @doc """
  Builds a move event for one node.
  """
  @spec move_event(
          DocTreeNodeDraft.t(),
          Ecto.UUID.t() | nil,
          integer(),
          Ecto.UUID.t() | nil,
          integer()
        ) ::
          map()
  def move_event(
        %DocTreeNodeDraft{} = node,
        before_parent_id,
        before_index,
        after_parent_id,
        after_index
      ) do
    %{
      type: "node.move",
      payload: %{
        "nodeId" => to_string(node.id),
        "title" => node.title,
        "beforeParentId" => stringify_id(before_parent_id),
        "afterParentId" => stringify_id(after_parent_id),
        "beforeIndex" => before_index,
        "afterIndex" => after_index
      },
      inverse: %{
        "nodeId" => to_string(node.id),
        "targetParentId" => stringify_id(before_parent_id),
        "targetIndex" => before_index
      }
    }
  end

  @doc """
  Marks all staged events as published by the given Tree revision.
  """
  @spec mark_staged_published(Community.t(), DocTreeRevision.t()) :: non_neg_integer()
  def mark_staged_published(%Community{} = community, %DocTreeRevision{} = revision) do
    {count, _} =
      DocTreeEvent
      |> where([e], e.community_id == ^community.id)
      |> where([e], e.status == :staged)
      |> Repo.update_all(
        set: [
          status: :published,
          published_revision_id: revision.id,
          updated_at: DateTime.utc_now(:second)
        ]
      )

    count
  end

  @doc """
  Creates a Tree revision from the current draft snapshot and archives events.
  """
  @spec publish_snapshot(Community.t(), integer() | nil, String.t() | nil) ::
          T.domain_res(DocTreeRevision.t())
  def publish_snapshot(%Community{} = community, author_id \\ nil, message \\ nil) do
    tree_json = Snapshot.draft_json(community)

    with {:ok, revision} <-
           ORM.create(DocTreeRevision, %{
             community_id: community.id,
             revision_number: next_revision_number(community),
             tree_json: tree_json,
             tree_hash: Snapshot.hash(tree_json),
             author_id: author_id,
             message: message,
             published_at: DateTime.utc_now(:second)
           }) do
      mark_staged_published(community, revision)
      {:ok, revision}
    end
  end

  defp field_update_event(before, after_node, :title, before_value, after_value) do
    type = if before.type == :group, do: "group.rename", else: "node.rename"

    %{
      type: type,
      payload: base_field_payload(before, "title", before_value, after_value),
      inverse: inverse_field_payload(after_node, "title", before_value)
    }
  end

  defp field_update_event(before, after_node, :marker, before_value, after_value) do
    %{
      type: "node.marker.update",
      payload: base_field_payload(before, "marker", before_value, after_value),
      inverse: inverse_field_payload(after_node, "marker", before_value)
    }
  end

  defp field_update_event(before, after_node, :href, before_value, after_value) do
    %{
      type: "link.href.update",
      payload: base_field_payload(before, "href", before_value, after_value),
      inverse: inverse_field_payload(after_node, "href", before_value)
    }
  end

  defp field_update_event(before, after_node, field, before_value, after_value) do
    field_name = Atom.to_string(field)

    %{
      type: "node.update",
      payload: base_field_payload(before, field_name, before_value, after_value),
      inverse: inverse_field_payload(after_node, field_name, before_value)
    }
  end

  defp base_field_payload(node, field, before_value, after_value) do
    %{
      "nodeId" => to_string(node.id),
      "nodeType" => to_string(node.type),
      "title" => node.title,
      "field" => field,
      "before" => before_value,
      "after" => after_value
    }
  end

  defp inverse_field_payload(node, field, value) do
    %{
      "nodeId" => to_string(node.id),
      "field" => field,
      "value" => value
    }
  end

  defp node_payload(%DocTreeNodeDraft{} = node) do
    Snapshot.node_json(node)
    |> Map.merge(%{
      "parentId" => stringify_id(node.parent_id),
      "index" => node.index
    })
  end

  defp stringify_id(nil), do: nil
  defp stringify_id(id), do: to_string(id)

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

  defp next_revision_number(%Community{} = community) do
    DocTreeRevision
    |> where([r], r.community_id == ^community.id)
    |> select([r], max(r.revision_number))
    |> Repo.one()
    |> case do
      nil -> 1
      revision -> revision + 1
    end
  end
end
