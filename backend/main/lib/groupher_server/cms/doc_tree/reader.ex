defmodule GroupherServer.CMS.DocTree.Reader do
  @moduledoc """
  Reader helpers for the docs editor tree.

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
  alias CMS.Docs.Branch
  alias CMS.DocTree.{ChangeDetection, Events}

  require CMS.Const

  alias CMS.Model.{
    DocSnapshot,
    Doc,
    Community,
    DocCoverCard,
    DocCoverItem,
    DocCoverPinnedDoc,
    DocsSiteState,
    DocTreeEvent,
    DocTreeNode,
    DocPublishRelease
  }

  alias Helper.{ORM, T, Transaction}

  @doc """
  Reads the current docs editor tree.

  ## Examples

      iex> Reader.read(community)
      {:ok, %{groups: groups, pins: pins}}
  """
  @spec read(Community.t(), keyword() | map()) :: T.domain_res(map())
  def read(%Community{} = community, opts \\ []) do
    actor = option(opts, :actor, :operations)
    policy_mode = option(opts, :policy_mode, :operations)

    with {:ok, community} <- scoped_community(community, actor, policy_mode),
         {:ok, branch} <- Branch.resolve(community, opts),
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
    with {:ok, community} <- public_community(community),
         {:ok, branch} <- Branch.resolve(community, opts) do
      nodes = tree_nodes_for_branch(community, branch, CMS.Const.stage(:public))
      docs_by_doc_id = public_docs_by_doc_id(community, branch, nodes)

      {:ok, %{tabs: build_public_tabs(community, nodes, docs_by_doc_id)}}
    end
  end

  @doc """
  Returns the Tree-level draft/publish state for footer UI.

  ## Examples

      iex> Reader.tree_state(community, state).has_unpublished_changes
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

      iex> Reader.read_draft(community, page.doc_id)
      {:ok, %Doc{stage: CMS.Const.stage(:draft)}}
  """
  @spec read_draft(Community.t(), String.t(), keyword() | map()) :: T.domain_res(Doc.t())
  def read_draft(%Community{} = community, doc_id, opts \\ []) do
    actor = option(opts, :actor, :operations)
    policy_mode = option(opts, :policy_mode, :operations)

    with {:ok, branch} <- Branch.resolve(community, opts) do
      query =
        Doc
        |> CMS.Articles.Trash.not_trashed_scope(:doc)
        |> CMS.Gate.scope(actor, :read_draft, %{
          thread: :doc,
          stage: :draft,
          policy_mode: policy_mode,
          branch_id: branch.id
        })

      case query do
        %Ecto.Query{} = query ->
          query
          |> where([doc], doc.article_hash_id == ^doc_id)
          |> where([doc], doc.community_id == ^community.id)
          |> where([doc], doc.branch_id == ^branch.id)
          |> where([doc], doc.stage == CMS.Const.stage(:draft))
          |> Repo.one()
          |> case do
            %Doc{} = doc -> {:ok, doc}
            nil -> {:error, {:not_exist, "Doc draft"}}
          end

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  @doc """
  Ensures the per-community docs site state exists.

  ## Examples

      iex> Reader.ensure_draft_state(community)
      {:ok, %DocsSiteState{}}
  """
  @spec ensure_draft_state(Community.t(), keyword() | map()) :: T.domain_res(DocsSiteState.t())
  def ensure_draft_state(%Community{} = community, opts \\ []),
    do: ensure_site_state(community, opts)

  @spec ensure_site_state(Community.t(), keyword() | map()) :: T.domain_res(DocsSiteState.t())
  def ensure_site_state(%Community{} = community, opts \\ []) do
    with {:ok, branch} <- Branch.resolve(community, opts) do
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
    with {:ok, branch} <- Branch.resolve(community, opts) do
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

  # `doc_public_tree` can receive a loaded Community from a parent resolver.
  # Re-scope it here so that path cannot bypass the public Community lifecycle
  # boundary merely because it did not originate from `Communities.read/1`.
  defp public_community(%Community{} = community) do
    case CMS.Gate.scope(Community, nil, :read) do
      %Ecto.Query{} = query ->
        query
        |> where([candidate], candidate.id == ^community.id)
        |> Repo.one()
        |> case do
          %Community{} = public_community -> {:ok, public_community}
          nil -> {:error, {:not_exist, "Community"}}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp scoped_community(%Community{} = community, actor, policy_mode) do
    case CMS.Gate.scope(Community, actor, :read, %{policy_mode: policy_mode}) do
      %Ecto.Query{} = query ->
        query
        |> where([candidate], candidate.id == ^community.id)
        |> Repo.one()
        |> case do
          %Community{} = scoped -> {:ok, scoped}
          nil -> {:error, {:not_exist, "Community"}}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp option(opts, key, default) when is_list(opts), do: Keyword.get(opts, key, default)
  defp option(opts, key, default) when is_map(opts), do: Map.get(opts, key, default)
  defp option(_opts, _key, default), do: default

  defp public_docs_by_doc_id(%Community{} = community, branch, nodes) do
    doc_ids =
      nodes
      |> Enum.map(& &1.doc_id)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    Doc
    |> CMS.Gate.scope(nil, :list, %{thread: :doc, branch_id: branch.id, policy_mode: :public})
    |> where([d], d.community_id == ^community.id)
    |> where([d], d.branch_id == ^branch.id)
    |> where([d], d.stage == ^CMS.Const.stage(:public))
    |> where([d], d.article_hash_id in ^doc_ids)
    |> Repo.all()
    |> Map.new(&{&1.article_hash_id, &1})
  end

  defp build_public_tabs(%Community{} = community, nodes, docs_by_doc_id) do
    navigation_by_parent =
      nodes
      |> Enum.filter(&(&1.type in [:group, :page, :link]))
      |> Enum.group_by(& &1.parent_node_id)

    pins_by_tab =
      nodes
      |> Enum.filter(&(&1.type == :pin and not hidden_node?(&1)))
      |> Enum.map(fn pin -> pin |> public_node_base() |> Map.put(:href, pin.href) end)
      |> Enum.group_by(& &1.parent_node_id)

    nodes
    |> Enum.filter(&(&1.type == :tab))
    |> Enum.reject(&hidden_node?/1)
    |> Enum.flat_map(fn tab ->
      groups =
        build_public_children(
          community,
          tab.node_id,
          navigation_by_parent,
          docs_by_doc_id,
          MapSet.new()
        )

      pins = Map.get(pins_by_tab, tab.node_id, [])

      if groups == [] and pins == [] do
        []
      else
        [
          tab
          |> public_node_base()
          |> Map.put(:pins, pins)
          |> Map.put(:groups, groups)
        ]
      end
    end)
  end

  defp build_tabs(nodes, context) do
    navigation_by_parent =
      nodes
      |> Enum.filter(&(&1.type in [:group, :page, :link]))
      |> Enum.group_by(& &1.parent_node_id)

    pins_by_tab = nodes |> pins(context) |> Enum.group_by(& &1.parent_node_id)

    nodes
    |> Enum.filter(&(&1.type == :tab))
    |> Enum.map(fn tab ->
      tab
      |> to_map(context)
      |> Map.put(:pins, Map.get(pins_by_tab, tab.node_id, []))
      |> Map.put(
        :groups,
        build_children(tab.node_id, navigation_by_parent, context, MapSet.new())
      )
    end)
  end

  defp build_children(parent_node_id, children_by_parent, context, ancestors) do
    if MapSet.member?(ancestors, parent_node_id) do
      []
    else
      ancestors = MapSet.put(ancestors, parent_node_id)

      children_by_parent
      |> Map.get(parent_node_id, [])
      |> Enum.sort_by(&{&1.index, &1.id})
      |> Enum.map(fn node ->
        node
        |> to_map(context)
        |> Map.put(
          :pages,
          if(node.type == :group,
            do: build_children(node.node_id, children_by_parent, context, ancestors),
            else: []
          )
        )
      end)
    end
  end

  defp build_public_children(
         community,
         parent_node_id,
         children_by_parent,
         docs_by_doc_id,
         ancestors
       ) do
    if MapSet.member?(ancestors, parent_node_id) do
      []
    else
      ancestors = MapSet.put(ancestors, parent_node_id)

      children_by_parent
      |> Map.get(parent_node_id, [])
      |> Enum.sort_by(&{&1.index, &1.id})
      |> Enum.reject(&hidden_node?/1)
      |> Enum.flat_map(fn
        %DocTreeNode{type: :group} = group ->
          pages =
            build_public_children(
              community,
              group.node_id,
              children_by_parent,
              docs_by_doc_id,
              ancestors
            )

          if pages == [],
            do: [],
            else: [group |> public_node_base() |> Map.put(:pages, pages)]

        node ->
          case public_child_map(community, node, docs_by_doc_id) do
            nil -> []
            child -> [child]
          end
      end)
    end
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
      parent_node_id: node.parent_node_id,
      doc_id: node.doc_id,
      type: node.type,
      title: node.title,
      index: node.index,
      href: nil,
      marker: node.marker,
      badge: node.badge,
      pages: []
    }
  end

  defp hidden_node?(%DocTreeNode{hidden: true}), do: true
  defp hidden_node?(_node), do: false

  @doc "Builds every recursive Group subtree from a flat node list."
  @spec build_groups(list(DocTreeNode.t()), map()) :: list(map())
  def build_groups(nodes, context \\ %{}) do
    children_by_parent =
      nodes
      |> Enum.filter(&(&1.type in [:group, :page, :link]))
      |> Enum.group_by(& &1.parent_node_id)

    nodes
    |> Enum.filter(&(&1.type == :group))
    |> Enum.map(fn group ->
      group
      |> to_map(context)
      |> Map.put(
        :pages,
        build_children(group.node_id, children_by_parent, context, MapSet.new())
      )
    end)
  end

  @doc """
  Converts a tree node into the GraphQL map shape.

  ## Examples

      iex> Reader.to_map(node).id == node.node_id
      true
  """
  @spec to_map(DocTreeNode.t(), map()) :: map()
  def to_map(%DocTreeNode{} = node, context \\ %{}) do
    context = default_context(context)

    %{
      id: node.node_id,
      parent_node_id: node.parent_node_id,
      doc_id: node.doc_id,
      type: node.type,
      title: node.title,
      index: node.index,
      href: node.href,
      marker: node.marker,
      badge: node.badge,
      hidden: node.hidden,
      publish_state: publish_state(node, context),
      pages: []
    }
  end

  defp default_context(context) do
    %{
      draft_versions: %{},
      public_versions: %{},
      public_nodes: %{},
      cover_cards: %{},
      cover_items: %{},
      pinned_docs: MapSet.new()
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
      |> CMS.Articles.Trash.not_trashed_scope(:doc)
      |> where([v], v.community_id == ^community.id)
      |> where([v], v.branch_id == ^branch.id)
      |> where([v], v.article_hash_id in ^doc_ids)
      |> where([v], v.stage == CMS.Const.stage(:draft))
      |> Repo.all()
      |> Map.new(&{&1.article_hash_id, &1})

    public_versions =
      DocSnapshot
      |> where([s], s.community_id == ^community.id)
      |> where([s], s.branch_id == ^branch.id)
      |> where([s], s.stage == CMS.Const.stage(:public))
      |> where([s], s.article_hash_id in ^doc_ids)
      |> order_by([s], desc: s.revision_number, desc: s.id)
      |> Repo.all()
      |> Enum.uniq_by(& &1.article_hash_id)
      |> Map.new(&{&1.article_hash_id, &1})

    public_row_ids =
      public_nodes
      |> Map.values()
      |> Enum.map(& &1.id)

    cover_cards =
      DocCoverCard
      |> where([card], card.community_id == ^community.id)
      |> where([card], card.group_node_id in ^public_row_ids)
      |> Repo.all()
      |> Map.new(&{&1.group_node_id, &1})

    cover_items =
      DocCoverItem
      |> where([i], i.community_id == ^community.id)
      |> where([i], i.node_id in ^public_row_ids)
      |> Repo.all()
      |> Map.new(&{&1.node_id, &1})

    pinned_docs =
      DocCoverPinnedDoc
      |> where([i], i.community_id == ^community.id)
      |> where([i], i.node_id in ^public_row_ids)
      |> Repo.all()
      |> Enum.map(& &1.node_id)
      |> MapSet.new()

    %{
      draft_versions: draft_versions,
      public_versions: public_versions,
      public_nodes: public_nodes,
      cover_cards: cover_cards,
      cover_items: cover_items,
      pinned_docs: pinned_docs
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
    cover_card = public_row_id && Map.get(context.cover_cards, public_row_id)
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
      in_cover: not is_nil(cover_card) or not is_nil(cover_item),
      hidden_from_cover: not is_nil(cover_item) and cover_item.hidden,
      pinned_to_cover: public_row_id && MapSet.member?(context.pinned_docs, public_row_id)
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
