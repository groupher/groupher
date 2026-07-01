defmodule GroupherServer.CMS.DocTree.Read do
  @moduledoc """
  Read helpers for the docs editor tree.

  The editor reads the draft stage. Public status is derived from the matching
  public-stage row with the same `node_id`.

      doc_tree_nodes(stage=draft)       doc_tree_nodes(stage=public)
      ---------------------------       ----------------------------
      node_id=group_1              -->  node_id=group_1
        node_id=page_1             -->    node_id=page_1

  GraphQL keeps `id` as the stable `node_id`; the physical database row id is
  intentionally not exposed.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.{ChangeDetection, Events}

  require CMS.Const

  alias CMS.Model.{
    ArticleSnapshot,
    Doc,
    Community,
    DocCoverGroup,
    DocCoverItem,
    DocCoverPinnedItem,
    DocsSiteState,
    DocTreeEvent,
    DocTreeNode,
    PublishRelease
  }

  alias Helper.{ORM, T, Transaction}

  @doc """
  Reads the current docs editor tree.

  ## Examples

      iex> Read.read(community)
      {:ok, %{groups: groups, pins: pins}}
  """
  @spec read(Community.t()) :: T.domain_res(map())
  def read(%Community{} = community) do
    with {:ok, _state} <- ensure_site_state(community) do
      Repo.transaction(fn ->
        {:ok, state} = ORM.find_by(DocsSiteState, community_id: community.id)
        nodes = tree_nodes(community, :draft)
        context = publish_context(community, nodes)

        %{
          revision: state.tree_lock_version,
          tree_state: tree_state(community, state),
          staged_events:
            Enum.map(
              Events.staged_events(community, owner: CMS.Const.doc_tree_action_owner(:tree)),
              &event_to_map/1
            ),
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

  ## Examples

      iex> Read.tree_state(community, state).has_unpublished_changes
      true
  """
  @spec tree_state(Community.t(), DocsSiteState.t()) :: map()
  def tree_state(%Community{} = community, %DocsSiteState{} = state) do
    latest_release = latest_release(community)
    latest_snapshot = latest_release && latest_release.tree_snapshot
    staged_event_count = Events.staged_tree_event_count(community)

    %{
      has_unpublished_changes: staged_event_count > 0,
      staged_event_count: staged_event_count,
      base_snapshot_id: state.base_snapshot_id,
      latest_snapshot_id: latest_snapshot && latest_snapshot.id,
      latest_release_id: latest_release && latest_release.id,
      latest_release_number: latest_release && latest_release.release_number,
      revision: state.tree_lock_version
    }
  end

  @doc """
  Reads one staged doc article version.

  ## Examples

      iex> Read.read_draft(community, page.doc_id)
      {:ok, %Doc{stage: CMS.Const.stage(:draft)}}
  """
  @spec read_draft(Community.t(), String.t()) :: T.domain_res(Doc.t())
  def read_draft(%Community{} = community, doc_id) do
    Doc
    |> ORM.find_by(doc_id: doc_id, community_id: community.id, stage: CMS.Const.stage(:draft))
  end

  @doc """
  Ensures the per-community docs site state exists.

  ## Examples

      iex> Read.ensure_draft_state(community)
      {:ok, %DocsSiteState{}}
  """
  @spec ensure_draft_state(Community.t()) :: T.domain_res(DocsSiteState.t())
  def ensure_draft_state(%Community{} = community), do: ensure_site_state(community)

  @spec ensure_site_state(Community.t()) :: T.domain_res(DocsSiteState.t())
  def ensure_site_state(%Community{} = community) do
    Transaction.lock_global("docs_site:init:#{community.id}", fn ->
      case ORM.find_by(DocsSiteState, community_id: community.id) do
        {:ok, state} -> {:ok, state}
        {:error, _} -> ORM.create(DocsSiteState, %{community_id: community.id})
      end
    end)
  end

  @doc """
  Builds normal groups from a flat node list.

  ## Examples

      iex> Read.build_groups(nodes)
      [%{type: :group, children: [_]}]
  """
  @spec build_groups(list(DocTreeNode.t()), map()) :: list(map())
  def build_groups(nodes, context \\ %{}) do
    children_by_group =
      nodes
      |> Enum.filter(&(&1.group_id && &1.type in [:page, :link]))
      |> Enum.group_by(& &1.group_id)

    nodes
    |> Enum.filter(&(&1.type == :group and &1.node_id != "pin"))
    |> Enum.map(fn group ->
      group
      |> to_map(context)
      |> Map.put(
        :children,
        Enum.map(Map.get(children_by_group, group.node_id, []), &to_map(&1, context))
      )
    end)
  end

  @doc """
  Converts a tree node into the GraphQL map shape.

  ## Examples

      iex> Read.to_map(node).id == node.node_id
      true
  """
  @spec to_map(DocTreeNode.t(), map()) :: map()
  def to_map(%DocTreeNode{} = node, context \\ %{}) do
    context = default_context(context)

    %{
      id: node.node_id,
      group_id: node.group_id,
      doc_id: node.doc_id,
      type: node.type,
      title: node.title,
      slug: node.slug,
      index: node.index,
      href: node.href,
      marker: node.marker,
      badge: node.badge,
      hidden: node.hidden,
      ui_config: node.ui_config,
      publish_state: publish_state(node, context),
      children: []
    }
  end

  defp default_context(context) do
    %{
      draft_versions: %{},
      public_versions: %{},
      public_nodes: %{},
      cover_groups: %{},
      cover_items: %{},
      pinned_items: MapSet.new()
    }
    |> Map.merge(context)
  end

  defp tree_nodes(%Community{} = community, stage) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.stage == ^stage)
    |> order_by([n], asc: n.index, asc: n.id)
    |> Repo.all()
  end

  defp publish_context(%Community{} = community, draft_nodes) do
    node_ids = Enum.map(draft_nodes, & &1.node_id)

    doc_ids =
      draft_nodes |> Enum.map(& &1.doc_id) |> Enum.reject(&is_nil/1)

    public_nodes =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.stage == CMS.Const.stage(:public))
      |> where([n], n.node_id in ^node_ids)
      |> Repo.all()
      |> Map.new(&{&1.node_id, &1})

    draft_versions =
      Doc
      |> where([v], v.community_id == ^community.id)
      |> where([v], v.doc_id in ^doc_ids)
      |> where([v], v.stage == CMS.Const.stage(:draft))
      |> Repo.all()
      |> Map.new(&{&1.doc_id, &1})

    public_versions =
      ArticleSnapshot
      |> where([s], s.community_id == ^community.id)
      |> where([s], s.stage == CMS.Const.stage(:public))
      |> where([s], s.article_thread == :doc)
      |> where([s], s.doc_id in ^doc_ids)
      |> order_by([s], desc: s.snapshot_number, desc: s.id)
      |> Repo.all()
      |> Enum.uniq_by(& &1.doc_id)
      |> Map.new(&{&1.doc_id, &1})

    public_row_ids =
      public_nodes
      |> Map.values()
      |> Enum.map(& &1.id)

    cover_groups =
      DocCoverGroup
      |> where([g], g.community_id == ^community.id)
      |> where([g], g.group_id in ^public_row_ids)
      |> Repo.all()
      |> Map.new(&{&1.group_id, &1})

    cover_items =
      DocCoverItem
      |> where([i], i.community_id == ^community.id)
      |> where([i], i.node_id in ^public_row_ids)
      |> Repo.all()
      |> Map.new(&{&1.node_id, &1})

    pinned_items =
      DocCoverPinnedItem
      |> where([i], i.community_id == ^community.id)
      |> where([i], i.node_id in ^public_row_ids)
      |> Repo.all()
      |> Enum.map(& &1.node_id)
      |> MapSet.new()

    %{
      draft_versions: draft_versions,
      public_versions: public_versions,
      public_nodes: public_nodes,
      cover_groups: cover_groups,
      cover_items: cover_items,
      pinned_items: pinned_items
    }
  end

  defp pins(nodes, context) do
    nodes
    |> Enum.filter(&(&1.type == :pin))
    |> Enum.map(&to_map(&1, context))
  end

  defp publish_state(%DocTreeNode{} = node, context) do
    public_node = Map.get(context.public_nodes, node.node_id)

    draft_version =
      node.doc_id && Map.get(context.draft_versions, node.doc_id)

    public_version =
      draft_version && Map.get(context.public_versions, node.doc_id)

    public_row_id = public_node && public_node.id
    cover_group = public_row_id && Map.get(context.cover_groups, public_row_id)
    cover_item = public_row_id && Map.get(context.cover_items, public_row_id)

    %{
      status: if(public_node, do: :public, else: :draft),
      published: not is_nil(public_node),
      published_before: not is_nil(public_node),
      has_draft: not is_nil(draft_version),
      public_node_id: public_node && public_node.node_id,
      public_doc_id: public_node && public_node.doc_id,
      has_unpublished_changes: article_changed?(draft_version, public_version),
      last_published_at: public_node && public_node.updated_at,
      in_cover: not is_nil(cover_group) or not is_nil(cover_item),
      hidden_from_cover: not is_nil(cover_item) and cover_item.hidden,
      pinned_to_cover: public_row_id && MapSet.member?(context.pinned_items, public_row_id)
    }
  end

  defp article_changed?(draft, public),
    do: ChangeDetection.draft_content_changed?(draft, public)

  defp latest_release(%Community{} = community) do
    PublishRelease
    |> where([r], r.community_id == ^community.id)
    |> order_by([r], desc: r.release_number, desc: r.id)
    |> preload(:tree_snapshot)
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
      owner: to_string(event.owner),
      doc_id: event.doc_id,
      inserted_at: event.inserted_at
    }
  end
end
