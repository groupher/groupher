defmodule GroupherServer.CMS.DocTree.Read do
  @moduledoc """
  Read helpers for the dashboard docs tree draft.

  `read/1` intentionally returns draft nodes. The GraphQL field is consumed by
  the dashboard editor and preview surface, not the public docs site. The public
  read path should use `doc_tree_nodes` after publish is implemented.

      doc_tree_node_drafts(parent_id: nil)
          group A
            page -> doc_draft_id
            link -> href
          group B
            page -> doc_draft_id

  The returned map keeps the API field as `doc_id` for frontend compatibility,
  but the value is a `doc_draft_id` while this resolver is in draft mode.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocsSiteState, DocTreeDraftState, DocTreeNodeDraft}
  alias Helper.{ORM, T, Transaction}

  @spec read(Community.t()) :: T.domain_res(map())
  def read(%Community{} = community) do
    with {:ok, state} <- ensure_draft_state(community) do
      nodes =
        DocTreeNodeDraft
        |> where([n], n.community_id == ^community.id)
        |> order_by([n], asc: n.index, asc: n.id)
        |> Repo.all()

      {:ok, %{revision: state.revision, groups: build_groups(nodes)}}
    end
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

  @spec build_groups(list(DocTreeNodeDraft.t())) :: list(map())
  def build_groups(nodes) do
    children_by_parent =
      nodes
      |> Enum.filter(& &1.parent_id)
      |> Enum.group_by(& &1.parent_id)

    nodes
    |> Enum.filter(&is_nil(&1.parent_id))
    |> Enum.map(fn group ->
      group
      |> to_map()
      |> Map.put(:children, Enum.map(Map.get(children_by_parent, group.id, []), &to_map/1))
    end)
  end

  @spec to_map(DocTreeNodeDraft.t()) :: map()
  def to_map(%DocTreeNodeDraft{} = node) do
    %{
      id: node.id,
      parent_id: node.parent_id,
      doc_id: node.doc_draft_id,
      type: node.type,
      title: node.title,
      slug: node.slug,
      index: node.index,
      href: node.href,
      icon: node.icon,
      badge: node.badge,
      hidden: node.hidden,
      expanded: node.expanded,
      children: []
    }
  end
end
