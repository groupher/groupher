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
  alias CMS.Articles.Branch
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
    DocPublishRelease
  }

  alias Helper.{ORM, T, Transaction}

  @doc """
  Reads the current docs editor tree.

  ## Examples

      iex> Read.read(community)
      {:ok, %{groups: groups, pins: pins}}
  """
  @spec read(Community.t(), keyword() | map()) :: T.domain_res(map())
  def read(%Community{} = community, opts \\ []) do
    with {:ok, branch} <- Branch.resolve(community, :doc, opts),
         {:ok, _state} <- ensure_site_state(community, branch) do
      Repo.transaction(fn ->
        {:ok, state} =
          ORM.find_by(DocsSiteState, community_id: community.id, branch_id: branch.id)

        nodes = tree_nodes_for_branch(community, branch, :draft)
        context = publish_context(community, branch, nodes)

        %{
          revision: state.tree_lock_version,
          tree_state: tree_state(community, state),
          staged_events:
            Enum.map(
              Events.staged_events(community,
                branch_id: branch.id,
                owner: CMS.Const.tree_event_owner(:tree)
              ),
              &event_to_map/1
            ),
          tabs: build_tabs(nodes, context)
        }
      end)
      |> case do
        {:ok, payload} -> {:ok, payload}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  @doc """
  Reads the published docs tree used by the public docs site.

  The public projection omits editor-only state such as draft revisions,
  staged events, and publish status. Page hrefs are resolved from the
  published docs article row so drafts cannot leak into the public reader.
  """
  @spec read_public(Community.t(), keyword() | map()) :: T.domain_res(map())
  def read_public(%Community{} = community, opts \\ []) do
    with {:ok, branch} <- Branch.resolve(community, :doc, opts) do
      nodes = tree_nodes_for_branch(community, branch, CMS.Const.stage(:public))
      docs_by_doc_id = public_docs_by_doc_id(community, branch, nodes)

      {:ok, %{tabs: build_public_tabs(community, nodes, docs_by_doc_id)}}
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
    latest_release = latest_release(community, state.branch_id)
    latest_snapshot = latest_release && latest_release.tree_snapshot
    staged_event_count = Events.staged_tree_event_count(community, branch_id: state.branch_id)

    %{
      has_unpublished_changes: staged_event_count > 0,
      staged_event_count: staged_event_count,
      base_snapshot_id: state.base_snapshot_id,
      latest_snapshot_id: latest_snapshot && latest_snapshot.id,
      latest_release_id: latest_release && latest_release.id,
      latest_release_number: latest_release && latest_release.release_number,
      latest_version_slug: latest_release && latest_release.version_slug,
      revision: state.tree_lock_version
    }
  end

  @doc """
  Reads one staged doc article version.

  ## Examples

      iex> Read.read_draft(community, page.doc_id)
      {:ok, %Doc{stage: CMS.Const.stage(:draft)}}
  """
  @spec read_draft(Community.t(), String.t(), keyword() | map()) :: T.domain_res(Doc.t())
  def read_draft(%Community{} = community, doc_id, opts \\ []) do
    with {:ok, branch} <- Branch.resolve(community, :doc, opts) do
      Doc
      |> CMS.Articles.active_scope(:doc)
      |> where([doc], doc.article_hash_id == ^doc_id)
      |> where([doc], doc.community_id == ^community.id)
      |> where([doc], doc.branch_id == ^branch.id)
      |> where([doc], doc.stage == CMS.Const.stage(:draft))
      |> Repo.one()
      |> case do
        %Doc{} = doc -> {:ok, doc}
        nil -> {:error, {:not_exist, "Doc draft"}}
      end
    end
  end

  @doc """
  Ensures the per-community docs site state exists.

  ## Examples

      iex> Read.ensure_draft_state(community)
      {:ok, %DocsSiteState{}}
  """
  @spec ensure_draft_state(Community.t(), keyword() | map()) :: T.domain_res(DocsSiteState.t())
  def ensure_draft_state(%Community{} = community, opts \\ []),
    do: ensure_site_state(community, opts)

  @spec ensure_site_state(Community.t(), keyword() | map()) :: T.domain_res(DocsSiteState.t())
  def ensure_site_state(%Community{} = community, opts \\ []) do
    with {:ok, branch} <- Branch.resolve(community, :doc, opts) do
      Transaction.lock_global("docs_site:init:#{community.id}:#{branch.id}", fn ->
        case ORM.find_by(DocsSiteState, community_id: community.id, branch_id: branch.id) do
          {:ok, state} ->
            {:ok, state}

          {:error, _} ->
            ORM.create(DocsSiteState, %{community_id: community.id, branch_id: branch.id})
        end
      end)
    end
  end

  def tree_nodes(%Community{} = community, opts, stage) do
    with {:ok, branch} <- Branch.resolve(community, :doc, opts) do
      {:ok, tree_nodes_for_branch(community, branch, stage)}
    end
  end

  def tree_nodes!(%Community{} = community, opts, stage) do
    case tree_nodes(community, opts, stage) do
      {:ok, nodes} -> nodes
      {:error, _} -> []
    end
  end

  defp tree_nodes_for_branch(%Community{} = community, branch, stage) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == ^stage)
    |> order_by([n], asc: n.index, asc: n.id)
    |> Repo.all()
  end

  defp public_docs_by_doc_id(%Community{} = community, branch, nodes) do
    doc_ids =
      nodes
      |> Enum.map(& &1.doc_id)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    Doc
    |> CMS.Articles.active_scope(:doc)
    |> where([d], d.community_id == ^community.id)
    |> where([d], d.branch_id == ^branch.id)
    |> where([d], d.stage == ^CMS.Const.stage(:public))
    |> where([d], d.article_hash_id in ^doc_ids)
    |> Repo.all()
    |> Map.new(&{&1.article_hash_id, &1})
  end

  defp build_public_groups(%Community{} = community, nodes, docs_by_doc_id) do
    children_by_group =
      nodes
      |> Enum.filter(&(&1.group_id && &1.type in [:page, :link]))
      |> Enum.reject(&hidden_node?/1)
      |> Enum.map(&public_child_map(community, &1, docs_by_doc_id))
      |> Enum.reject(&is_nil/1)
      |> Enum.group_by(& &1.group_id)

    nodes
    |> Enum.filter(&(&1.type == :group and &1.node_id != "pin"))
    |> Enum.reject(&hidden_node?/1)
    |> Enum.map(fn group ->
      group
      |> public_node_base()
      |> Map.put(:children, Map.get(children_by_group, group.node_id, []))
    end)
  end

  defp build_public_tabs(%Community{} = community, nodes, docs_by_doc_id) do
    groups = build_public_groups(community, nodes, docs_by_doc_id)
    groups_by_tab = Enum.group_by(groups, & &1.tab_id)

    pins_by_tab =
      nodes
      |> Enum.filter(&(&1.type == :pin and not hidden_node?(&1)))
      |> Enum.map(fn pin -> pin |> public_node_base() |> Map.put(:href, pin.href) end)
      |> Enum.group_by(& &1.tab_id)

    nodes
    |> Enum.filter(&(&1.type == :tab))
    |> Enum.reject(&hidden_node?/1)
    |> Enum.map(fn tab ->
      tab
      |> public_node_base()
      |> Map.put(:pins, Map.get(pins_by_tab, tab.node_id, []))
      |> Map.put(:groups, Map.get(groups_by_tab, tab.node_id, []))
    end)
  end

  defp build_tabs(nodes, context) do
    groups = build_groups(nodes, context)
    groups_by_tab = Enum.group_by(groups, & &1.tab_id)
    pins_by_tab = nodes |> pins(context) |> Enum.group_by(& &1.tab_id)

    nodes
    |> Enum.filter(&(&1.type == :tab))
    |> Enum.map(fn tab ->
      tab
      |> to_map(context)
      |> Map.put(:pins, Map.get(pins_by_tab, tab.node_id, []))
      |> Map.put(:groups, Map.get(groups_by_tab, tab.node_id, []))
    end)
  end

  defp public_child_map(
         %Community{} = community,
         %DocTreeNode{type: :page} = node,
         docs_by_doc_id
       ) do
    case Map.get(docs_by_doc_id, node.doc_id) do
      %Doc{inner_id: inner_id, slug: slug}
      when not is_nil(inner_id) and is_binary(slug) and slug != "" ->
        node
        |> public_node_base()
        |> Map.put(:href, "/#{community.slug}/doc/#{inner_id}/#{slug}")

      _ ->
        nil
    end
  end

  defp public_child_map(_community, %DocTreeNode{type: :link, href: href} = node, _docs_by_doc_id)
       when is_binary(href) and href != "" do
    node
    |> public_node_base()
    |> Map.put(:href, href)
  end

  defp public_child_map(_community, _node, _docs_by_doc_id), do: nil

  defp public_node_base(%DocTreeNode{} = node) do
    %{
      id: node.node_id,
      tab_id: node.tab_id,
      group_id: node.group_id,
      doc_id: node.doc_id,
      type: node.type,
      title: node.title,
      slug: node.slug,
      index: node.index,
      href: nil,
      marker: node.marker,
      badge: node.badge,
      children: []
    }
  end

  defp hidden_node?(%DocTreeNode{hidden: true}), do: true
  defp hidden_node?(_node), do: false

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
      tab_id: node.tab_id,
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

  defp publish_context(%Community{} = community, branch, draft_nodes) do
    node_ids = Enum.map(draft_nodes, & &1.node_id)

    doc_ids =
      draft_nodes |> Enum.map(& &1.doc_id) |> Enum.reject(&is_nil/1)

    public_nodes =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == CMS.Const.stage(:public))
      |> where([n], n.node_id in ^node_ids)
      |> Repo.all()
      |> Map.new(&{&1.node_id, &1})

    draft_versions =
      Doc
      |> CMS.Articles.active_scope(:doc)
      |> where([v], v.community_id == ^community.id)
      |> where([v], v.branch_id == ^branch.id)
      |> where([v], v.article_hash_id in ^doc_ids)
      |> where([v], v.stage == CMS.Const.stage(:draft))
      |> Repo.all()
      |> Map.new(&{&1.article_hash_id, &1})

    public_versions =
      ArticleSnapshot
      |> where([s], s.community_id == ^community.id)
      |> where([s], s.branch_id == ^branch.id)
      |> where([s], s.stage == CMS.Const.stage(:public))
      |> where([s], s.thread == :doc)
      |> where([s], s.article_hash_id in ^doc_ids)
      |> order_by([s], desc: s.revision_number, desc: s.id)
      |> Repo.all()
      |> Enum.uniq_by(& &1.article_hash_id)
      |> Map.new(&{&1.article_hash_id, &1})

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

  defp latest_release(%Community{} = community, branch_id) do
    DocPublishRelease
    |> where([r], r.community_id == ^community.id)
    |> where([r], r.branch_id == ^branch_id)
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
