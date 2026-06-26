defmodule GroupherServer.CMS.DocTree.Read do
  @moduledoc """
  Read helpers for the dashboard docs tree draft.

  `read/1` intentionally returns draft nodes. The GraphQL field is consumed by
  the dashboard editor and preview surface, not the public docs site. The public
  docs cover uses `doc_cover_*` rows that reference published `doc_tree_nodes`.

      doc_tree_node_drafts(parent_id: nil)
          group A
            page -> article_draft_id
            link -> href
          group B
            page -> article_draft_id

  The returned map keeps the API field as `doc_id` for frontend compatibility,
  but the value is an `article_draft_id` while this resolver is in draft mode.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.DocTree.Events

  alias CMS.Model.{
    ArticleDraft,
    Community,
    DocCoverGroup,
    DocCoverItem,
    DocCoverPinnedItem,
    DocsSiteState,
    DocTreeEvent,
    DocTreeDraftState,
    DocTreeNode,
    DocTreeNodeDraft,
    DocTreeNodePublishMapping,
    DocTreeRevision
  }

  alias CMS.DocTree.ChangeDetection
  alias Helper.{ORM, T, Transaction}

  @spec read(Community.t()) :: T.domain_res(map())
  def read(%Community{} = community) do
    with {:ok, _state} <- ensure_draft_state(community) do
      Repo.transaction(fn ->
        {:ok, state} = ORM.find_by(DocTreeDraftState, community_id: community.id)

        nodes =
          DocTreeNodeDraft
          |> where([n], n.community_id == ^community.id)
          |> where([n], is_nil(n.deleted_at))
          |> order_by([n], asc: n.index, asc: n.id)
          |> Repo.all()

        context = publish_context(community, nodes)

        %{
          revision: state.revision,
          tree_state: tree_state(community, state),
          staged_events: Enum.map(Events.staged_events(community), &event_to_map/1),
          pins: pins(nodes, context),
          groups: build_groups(nodes, context)
        }
      end)
      |> case do
        {:ok, payload} -> {:ok, payload}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  @doc """
  Returns the Tree-level draft/publish state for footer UI.

      item publish_state.has_unpublished_changes -> doc content only
      tree_state.has_unpublished_changes         -> navigation/tree staged events
  """
  @spec tree_state(Community.t(), DocTreeDraftState.t()) :: map()
  def tree_state(%Community{} = community, %DocTreeDraftState{} = state) do
    latest_revision = latest_tree_revision(community)

    %{
      has_unpublished_changes: state.staged_event_count > 0,
      staged_event_count: state.staged_event_count,
      base_revision_id: state.base_revision_id,
      latest_revision_id: latest_revision && latest_revision.id,
      latest_revision_number: latest_revision && latest_revision.revision_number,
      revision: state.revision
    }
  end

  @doc """
  Reads one staged article draft from the docs editor scope.

  ## Examples

      iex> Read.read_draft(community, page.doc_id)
      {:ok, %ArticleDraft{thread: :doc}}
  """
  @spec read_draft(Community.t(), T.id()) :: T.domain_res(ArticleDraft.t())
  def read_draft(%Community{} = community, id) do
    ArticleDraft
    |> ORM.find_by(id: id, community_id: community.id, thread: :doc)
  end

  @spec ensure_draft_state(Community.t()) :: T.domain_res(DocTreeDraftState.t())
  def ensure_draft_state(%Community{} = community) do
    Transaction.lock_global("doc_tree:draft:init:#{community.id}", fn ->
      case ORM.find_by(DocTreeDraftState, community_id: community.id) do
        {:ok, state} ->
          {:ok, state}

        {:error, _} ->
          ORM.create(DocTreeDraftState, %{community_id: community.id})
      end
    end)
  end

  @spec ensure_site_state(Community.t()) :: T.domain_res(DocsSiteState.t())
  def ensure_site_state(%Community{} = community) do
    Transaction.lock_global("docs_site:init:#{community.id}", fn ->
      case ORM.find_by(DocsSiteState, community_id: community.id) do
        {:ok, state} ->
          {:ok, state}

        {:error, _} ->
          ORM.create(DocsSiteState, %{community_id: community.id})
      end
    end)
  end

  @spec build_groups(list(DocTreeNodeDraft.t()), map()) :: list(map())
  def build_groups(nodes, context \\ %{}) do
    children_by_parent =
      nodes
      |> Enum.filter(& &1.parent_id)
      |> Enum.group_by(& &1.parent_id)

    nodes
    |> Enum.filter(&(&1.type == :group))
    |> Enum.map(fn group ->
      group
      |> to_map(context)
      |> Map.put(
        :children,
        Enum.map(Map.get(children_by_parent, group.id, []), &to_map(&1, context))
      )
    end)
  end

  @spec to_map(DocTreeNodeDraft.t(), map()) :: map()
  def to_map(%DocTreeNodeDraft{} = node, context \\ %{}) do
    %{
      id: node.id,
      parent_id: node.parent_id,
      doc_id: node.article_draft_id,
      target_node_id: node.target_node_id,
      type: node.type,
      title: node.title,
      slug: node.slug,
      index: node.index,
      href: node.href,
      marker: node.marker,
      badge: node.badge,
      hidden: node.hidden,
      ui_config: node.ui_config,
      target: target_map(node, context),
      publish_state: publish_state(node, context),
      children: []
    }
  end

  defp publish_context(%Community{} = community, nodes) do
    draft_node_ids = Enum.map(nodes, & &1.id)
    draft_doc_ids = nodes |> Enum.map(& &1.article_draft_id) |> Enum.reject(&is_nil/1)

    mappings =
      DocTreeNodePublishMapping
      |> where([m], m.community_id == ^community.id)
      |> where([m], m.draft_node_id in ^draft_node_ids)
      |> Repo.all()
      |> Map.new(&{&1.draft_node_id, &1})

    draft_docs =
      ArticleDraft
      |> where([d], d.community_id == ^community.id)
      |> where([d], d.id in ^draft_doc_ids)
      |> Repo.all()
      |> Map.new(&{&1.id, &1})

    published_node_ids = mappings |> Map.values() |> Enum.map(& &1.published_node_id)

    published_nodes =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.id in ^published_node_ids)
      |> Repo.all()
      |> Map.new(&{&1.id, &1})

    cover_groups =
      DocCoverGroup
      |> where([g], g.community_id == ^community.id)
      |> where([g], g.group_id in ^published_node_ids)
      |> Repo.all()
      |> Map.new(&{&1.group_id, &1})

    cover_items =
      DocCoverItem
      |> where([i], i.community_id == ^community.id)
      |> where([i], i.node_id in ^published_node_ids)
      |> Repo.all()
      |> Map.new(&{&1.node_id, &1})

    pinned_items =
      DocCoverPinnedItem
      |> where([i], i.community_id == ^community.id)
      |> where([i], i.node_id in ^published_node_ids)
      |> Repo.all()
      |> Enum.map(& &1.node_id)
      |> MapSet.new()

    %{
      mappings: mappings,
      draft_docs: draft_docs,
      published_nodes: published_nodes,
      cover_groups: cover_groups,
      cover_items: cover_items,
      pinned_items: pinned_items
    }
  end

  defp pins(nodes, context) do
    nodes_by_id = Map.new(nodes, &{&1.id, &1})
    context = Map.put(context, :nodes_by_id, nodes_by_id)

    nodes
    |> Enum.filter(&(&1.type == :pin))
    |> Enum.map(&to_map(&1, context))
  end

  defp target_map(%DocTreeNodeDraft{type: :pin, target_node_id: target_node_id}, context)
       when not is_nil(target_node_id) do
    context
    |> Map.get(:nodes_by_id, %{})
    |> Map.get(target_node_id)
    |> case do
      %DocTreeNodeDraft{} = target -> to_map(target, Map.delete(context, :nodes_by_id))
      _ -> nil
    end
  end

  defp target_map(_node, _context), do: nil

  defp publish_state(%DocTreeNodeDraft{} = node, %{mappings: mappings} = context) do
    case Map.get(mappings, node.id) do
      %DocTreeNodePublishMapping{} = mapping ->
        public? = mapping.visibility == :public
        cover_group = Map.get(context.cover_groups, mapping.published_node_id)
        cover_item = Map.get(context.cover_items, mapping.published_node_id)
        has_unpublished_changes = public? and unpublished_changes?(node, mapping, context)

        %{
          status: mapping.visibility,
          published: public?,
          published_before: true,
          published_node_id: mapping.published_node_id,
          published_doc_id: mapping.published_doc_id,
          has_unpublished_changes: has_unpublished_changes,
          last_published_at: mapping.last_published_at,
          in_cover: public? and (not is_nil(cover_group) or not is_nil(cover_item)),
          hidden_from_cover: public? and not is_nil(cover_item) and cover_item.hidden,
          pinned_to_cover:
            public? and MapSet.member?(context.pinned_items, mapping.published_node_id)
        }

      _ ->
        %{
          status: :draft,
          published: false,
          published_before: false,
          published_node_id: nil,
          published_doc_id: nil,
          has_unpublished_changes: false,
          last_published_at: nil,
          in_cover: false,
          hidden_from_cover: false,
          pinned_to_cover: false
        }
    end
  end

  defp publish_state(_node, _context) do
    %{
      status: :draft,
      published: false,
      published_before: false,
      published_node_id: nil,
      published_doc_id: nil,
      has_unpublished_changes: false,
      last_published_at: nil,
      in_cover: false,
      hidden_from_cover: false,
      pinned_to_cover: false
    }
  end

  defp unpublished_changes?(
         %DocTreeNodeDraft{} = node,
         %DocTreeNodePublishMapping{} = mapping,
         %{draft_docs: draft_docs}
       ) do
    draft_doc = node.article_draft_id && Map.get(draft_docs, node.article_draft_id)

    ChangeDetection.draft_doc_content_changed?(draft_doc, mapping.draft_doc_content_hash)
  end

  defp latest_tree_revision(%Community{} = community) do
    DocTreeRevision
    |> where([r], r.community_id == ^community.id)
    |> order_by([r], desc: r.revision_number)
    |> limit(1)
    |> Repo.one()
  end

  defp event_to_map(%DocTreeEvent{} = event) do
    %{
      id: event.id,
      seq: event.seq,
      event_type: event.event_type,
      payload: event.payload,
      inverse_payload: event.inverse_payload,
      status: to_string(event.status),
      inserted_at: event.inserted_at
    }
  end
end
