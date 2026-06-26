defmodule GroupherServer.CMS.DocTree.Publish do
  @moduledoc """
  Publishes dashboard docs tree nodes into the public tree.

      dashboard draft tree                 public tree
      --------------------                 -----------
      doc_tree_node_drafts(group)  --->    doc_tree_nodes(group)
              |                                      |
              v                                      v
      doc_tree_node_drafts(page)   --->    doc_tree_nodes(page)
              |                                      |
              v                                      v
      article_drafts              --->    docs

      doc_tree_node_publish_mappings keeps the draft/public pairs.
      doc_cover_* always points at the public tree side.

  This module owns tree-node publication only. Article content publication stays
  in `CMS.Articles`; cover synchronization is delegated to `CMS.DocCover.Sync`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User

  alias CMS.DocTree.{ChangeDetection, Events, PublishedFields, Read}

  alias CMS.Model.{
    ArticleDraft,
    Community,
    DocTreeNode,
    DocTreeNodeDraft,
    DocTreeNodePublishMapping
  }

  alias Helper.{ORM, T, Transaction}

  @doc """
  Publishes one docs draft and its side-tree page node.

  The default mode also syncs the published page into the docs cover. Pass
  `sync_cover: false` for the "publish doc only" menu option.
  """
  @spec publish_doc(Community.t(), T.id(), User.t(), keyword()) ::
          T.domain_res(CMS.Model.ArticleRevision.t())
  def publish_doc(%Community{} = community, article_draft_id, %User{} = user, opts \\ []) do
    sync_cover? = Keyword.get(opts, :sync_cover, true)

    with {:ok, draft_page} <- find_draft_page(community, article_draft_id),
         {:ok, draft_group} <- find_draft_group(community, draft_page.parent_id),
         {:ok, revision} <-
           CMS.Articles.publish_doc_draft_revision(community, article_draft_id, user),
         {:ok, article_draft} <- ORM.find(ArticleDraft, article_draft_id),
         {:ok, published_group} <- upsert_published_group(community, draft_group),
         {:ok, published_page} <-
           upsert_published_page(community, draft_page, published_group.id, revision.article_id),
         {:ok, _group_mapping} <-
           upsert_mapping(community, draft_group, published_group, nil, nil),
         {:ok, _page_mapping} <-
           upsert_mapping(
             community,
             draft_page,
             published_page,
             article_draft,
             revision.article_id
           ),
         {:ok, _sync} <-
           maybe_sync_cover(community, published_group, published_page, sync_cover?) do
      {:ok, revision}
    end
  end

  @doc """
  Publishes every draft page that currently shows an unpublished signal.

      draft tree pages
             |
             v
      no public mapping OR draft has changed?
             |
             v
      publish_doc(...)

  The side-tree dot uses the same boundary, so the bulk action clears both docs
  that are currently draft-only and docs that are public with newer draft edits.
  """
  @spec publish_all_unpublished_docs(Community.t(), User.t(), keyword()) :: T.domain_res(map())
  def publish_all_unpublished_docs(%Community{} = community, %User{} = user, opts \\ []) do
    sync_cover? = Keyword.get(opts, :sync_cover, true)

    community
    |> unpublished_draft_pages()
    |> Enum.reduce_while({:ok, 0}, fn %DocTreeNodeDraft{article_draft_id: article_draft_id},
                                      {:ok, count} ->
      case publish_doc(community, article_draft_id, user, sync_cover: sync_cover?) do
        {:ok, _revision} -> {:cont, {:ok, count + 1}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, count} -> {:ok, %{done: true, count: count}}
      error -> error
    end
  end

  @doc """
  Publishes one docs side-tree group and all of its children.

  Group publish is batch-scoped by design: the draft group and its children are
  loaded once, the public group is upserted once, and cover sync ensures the
  cover group once before seeding page items. Page children still publish their
  article draft revisions; link children only publish their tree-node mapping.
  """
  @spec publish_group(Community.t(), T.id(), User.t(), keyword()) :: T.domain_res(map())
  def publish_group(%Community{} = community, draft_group_id, %User{} = user, opts \\ []) do
    sync_cover? = Keyword.get(opts, :sync_cover, true)

    with {:ok, draft_group} <- find_draft_group(community, draft_group_id),
         children <- draft_group_children(community, draft_group.id),
         context <- batch_publish_context(community, draft_group, children),
         {:ok, published_group} <- upsert_published_group(community, draft_group, context),
         {:ok, _group_mapping} <-
           upsert_mapping(community, draft_group, published_group, nil, nil, context),
         {:ok, result} <-
           publish_group_children(community, children, published_group, user, context),
         {:ok, _sync} <-
           maybe_sync_cover_group(community, published_group, result.pages, sync_cover?) do
      {:ok, %{done: true, count: result.count}}
    end
  end

  @doc """
  Publishes only the docs Tree scope.

      draft tree rows + staged tree events
                    |
                    v
          published tree rows + TreeRevision

  This does not publish article drafts. Page nodes must already have public doc
  mappings; a future combined publish can compose doc publication with this
  operation.
  """
  @spec publish_tree(Community.t(), User.t(), keyword()) :: T.domain_res(map())
  def publish_tree(%Community{} = community, %User{} = user, opts \\ []) do
    Transaction.lock_global("doc_tree:#{community.id}", fn ->
      Repo.transaction(fn ->
        with {:ok, state} <- Read.ensure_draft_state(community),
             draft_nodes <- active_draft_tree_nodes(community),
             deleted_nodes <- deleted_draft_tree_nodes(community),
             draft_groups <- Enum.filter(draft_nodes, &(&1.type == :group)),
             children_by_parent <-
               draft_nodes |> Enum.filter(& &1.parent_id) |> Enum.group_by(& &1.parent_id),
             context <- batch_publish_context(community, nil, draft_nodes),
             {:ok, _published_groups} <-
               publish_tree_groups(community, draft_groups, children_by_parent, context),
             pin_context <- batch_publish_context(community, nil, draft_nodes),
             :ok <- publish_tree_pins(community, draft_nodes, pin_context),
             :ok <- cleanup_deleted_tree_nodes(community, deleted_nodes),
             {:ok, revision} <-
               Events.publish_snapshot(community, user.id, Keyword.get(opts, :message)),
             {:ok, state} <-
               ORM.update(state, %{
                 base_revision_id: revision.id,
                 staged_event_count: 0
               }) do
          %{done: true, revision: state.revision, tree_revision: revision}
        else
          {:error, reason} -> Repo.rollback(reason)
          reason -> Repo.rollback(reason)
        end
      end)
      |> case do
        {:ok, result} -> {:ok, result}
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  @doc """
  Moves one public docs page back to draft visibility.

      doc_tree_node_publish_mappings.visibility
                 |
          public +--> draft

  The published node and doc row are intentionally kept. Re-publishing the draft
  flips the same mapping back to public instead of creating a new public id.
  """
  @spec move_doc_to_draft(Community.t(), T.id()) :: T.domain_res(map())
  def move_doc_to_draft(%Community{} = community, draft_node_id) do
    with {:ok, draft_page} <- find_draft_page_by_node_id(community, draft_node_id),
         {:ok, mapping} <- mapping_for_draft(community, draft_page.id),
         :ok <- ensure_public_mapping(mapping) do
      ORM.update(mapping, %{
        visibility: :draft,
        last_moved_to_draft_at: DateTime.utc_now(:second)
      })
      |> case do
        {:ok, _mapping} -> {:ok, %{done: true}}
        error -> error
      end
    end
  end

  @doc """
  Moves one public docs side-tree group and all published children to draft visibility.

  The published rows stay in place. Public reads already filter by mapping
  visibility, so this is a bulk mapping update rather than a destructive cover
  or public-tree cleanup.
  """
  @spec move_group_to_draft(Community.t(), T.id()) :: T.domain_res(map())
  def move_group_to_draft(%Community{} = community, draft_group_id) do
    with {:ok, draft_group} <- find_draft_group(community, draft_group_id) do
      draft_node_ids =
        [draft_group | draft_group_children(community, draft_group.id)]
        |> Enum.map(& &1.id)

      {count, _} =
        DocTreeNodePublishMapping
        |> where([m], m.community_id == ^community.id)
        |> where([m], m.draft_node_id in ^draft_node_ids)
        |> where([m], m.visibility == :public)
        |> Repo.update_all(
          set: [
            visibility: :draft,
            last_moved_to_draft_at: DateTime.utc_now(:second)
          ]
        )

      {:ok, %{done: true, count: count}}
    end
  end

  @doc """
  Returns the published mapping for one draft tree node.

  Cover mutations use this to resolve dashboard draft ids into public tree ids.
  """
  @spec mapping_for_draft(Community.t(), T.id()) :: T.domain_res(DocTreeNodePublishMapping.t())
  def mapping_for_draft(%Community{} = community, draft_node_id) do
    ORM.find_by(DocTreeNodePublishMapping,
      community_id: community.id,
      draft_node_id: draft_node_id
    )
  end

  defp find_draft_page(%Community{} = community, article_draft_id) do
    DocTreeNodeDraft
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.type == :page)
    |> where([n], n.article_draft_id == ^article_draft_id)
    |> where([n], is_nil(n.deleted_at))
    |> Repo.one()
    |> case do
      %DocTreeNodeDraft{} = node -> {:ok, node}
      nil -> {:error, {:custom, "docs draft page has not been added to the side tree"}}
    end
  end

  defp find_draft_group(%Community{} = community, group_id) do
    DocTreeNodeDraft
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.type == :group)
    |> where([n], n.id == ^group_id)
    |> where([n], is_nil(n.deleted_at))
    |> Repo.one()
    |> case do
      %DocTreeNodeDraft{} = node -> {:ok, node}
      nil -> {:error, {:custom, "docs draft page group does not exist"}}
    end
  end

  defp find_draft_page_by_node_id(%Community{} = community, draft_node_id) do
    DocTreeNodeDraft
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.type == :page)
    |> where([n], n.id == ^draft_node_id)
    |> where([n], is_nil(n.deleted_at))
    |> Repo.one()
    |> case do
      %DocTreeNodeDraft{} = node -> {:ok, node}
      nil -> {:error, {:custom, "docs draft page does not exist"}}
    end
  end

  defp draft_group_children(%Community{} = community, group_id) do
    DocTreeNodeDraft
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.parent_id == ^group_id)
    |> where([n], n.type in [:page, :link])
    |> where([n], is_nil(n.deleted_at))
    |> order_by([n], asc: n.index, asc: n.id)
    |> Repo.all()
  end

  defp active_draft_tree_nodes(%Community{} = community) do
    DocTreeNodeDraft
    |> where([n], n.community_id == ^community.id)
    |> where([n], is_nil(n.deleted_at))
    |> order_by([n], asc: n.index, asc: n.id)
    |> Repo.all()
  end

  defp deleted_draft_tree_nodes(%Community{} = community) do
    DocTreeNodeDraft
    |> where([n], n.community_id == ^community.id)
    |> where([n], not is_nil(n.deleted_at))
    |> order_by([n], asc: n.index, asc: n.id)
    |> Repo.all()
  end

  defp unpublished_draft_pages(%Community{} = community) do
    DocTreeNodeDraft
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.type == :page)
    |> where([n], not is_nil(n.article_draft_id))
    |> where([n], is_nil(n.deleted_at))
    |> join(:inner, [n], g in DocTreeNodeDraft, on: g.id == n.parent_id)
    |> where([_n, g], is_nil(g.deleted_at))
    |> join(:left, [n, _g], m in DocTreeNodePublishMapping,
      on: m.community_id == n.community_id and m.draft_node_id == n.id
    )
    |> join(:left, [n, _g, _m], d in ArticleDraft,
      on: d.community_id == n.community_id and d.id == n.article_draft_id
    )
    |> order_by([n, g, _m, _d], asc: g.index, asc: n.index, asc: n.id)
    |> select([n, _g, m, d], {n, m, d})
    |> Repo.all()
    |> Enum.filter(fn {node, mapping, draft_doc} ->
      ChangeDetection.unpublished_mapping?(node, mapping, nil, draft_doc)
    end)
    |> Enum.map(fn {node, _mapping, _draft_doc} -> node end)
  end

  defp batch_publish_context(%Community{} = community, group, children) do
    draft_nodes = if is_nil(group), do: children, else: [group | children]
    draft_node_ids = Enum.map(draft_nodes, & &1.id)
    draft_doc_ids = draft_nodes |> Enum.map(& &1.article_draft_id) |> Enum.reject(&is_nil/1)

    mappings =
      DocTreeNodePublishMapping
      |> where([m], m.community_id == ^community.id)
      |> where([m], m.draft_node_id in ^draft_node_ids)
      |> Repo.all()
      |> Map.new(&{&1.draft_node_id, &1})

    published_node_ids = mappings |> Map.values() |> Enum.map(& &1.published_node_id)

    published_nodes =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.id in ^published_node_ids)
      |> Repo.all()
      |> Map.new(&{&1.id, &1})

    draft_docs =
      ArticleDraft
      |> where([d], d.community_id == ^community.id)
      |> where([d], d.id in ^draft_doc_ids)
      |> Repo.all()
      |> Map.new(&{&1.id, &1})

    %{draft_docs: draft_docs, mappings: mappings, published_nodes: published_nodes}
  end

  defp publish_tree_groups(%Community{} = community, draft_groups, children_by_parent, context) do
    draft_groups
    |> Enum.reduce_while({:ok, []}, fn draft_group, {:ok, acc} ->
      with {:ok, published_group} <- upsert_published_group(community, draft_group, context),
           {:ok, _mapping} <-
             upsert_mapping(community, draft_group, published_group, nil, nil, context),
           {:ok, _children} <-
             publish_tree_children(
               community,
               Map.get(children_by_parent, draft_group.id, []),
               published_group,
               context
             ) do
        {:cont, {:ok, [published_group | acc]}}
      else
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, groups} -> {:ok, Enum.reverse(groups)}
      error -> error
    end
  end

  defp publish_tree_children(
         %Community{} = community,
         children,
         %DocTreeNode{} = published_group,
         context
       ) do
    children
    |> Enum.reduce_while({:ok, []}, fn child, {:ok, acc} ->
      result =
        case child.type do
          :page -> publish_tree_page(community, child, published_group, context)
          :link -> publish_group_link(community, child, published_group, context)
        end

      case result do
        {:ok, node} -> {:cont, {:ok, [node | acc]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, nodes} -> {:ok, Enum.reverse(nodes)}
      error -> error
    end
  end

  defp publish_tree_page(
         %Community{} = community,
         %DocTreeNodeDraft{} = draft_page,
         %DocTreeNode{} = published_group,
         context
       ) do
    with %DocTreeNodePublishMapping{visibility: :public} = mapping <-
           Map.get(context.mappings, draft_page.id),
         published_doc_id when not is_nil(published_doc_id) <- mapping.published_doc_id,
         {:ok, published_page} <-
           upsert_published_page(
             community,
             draft_page,
             published_group.id,
             published_doc_id,
             context
           ),
         {:ok, _mapping} <-
           upsert_mapping(
             community,
             draft_page,
             published_page,
             Map.get(context.draft_docs, draft_page.article_draft_id),
             published_doc_id,
             context
           ) do
      {:ok, published_page}
    else
      {:error, _reason} = error -> error
      _ -> {:error, {:custom, "Publish docs before publishing tree."}}
    end
  end

  defp publish_tree_pins(%Community{} = community, draft_nodes, context) do
    draft_nodes
    |> Enum.filter(&(&1.type == :pin))
    |> Enum.reduce_while(:ok, fn draft_pin, :ok ->
      with %DocTreeNodePublishMapping{visibility: :public} = target_mapping <-
             Map.get(context.mappings, draft_pin.target_node_id),
           published_target_id when not is_nil(published_target_id) <-
             target_mapping.published_node_id,
           :ok <- ensure_pin_target_type(draft_nodes, draft_pin.target_node_id),
           {:ok, published_pin} <-
             upsert_published_pin(community, draft_pin, published_target_id, context),
           {:ok, _mapping} <-
             upsert_mapping(community, draft_pin, published_pin, nil, nil, context) do
        {:cont, :ok}
      else
        {:error, _reason} = error -> {:halt, error}
        _ -> {:halt, {:error, {:custom, "Publish pinned docs before publishing tree."}}}
      end
    end)
  end

  defp ensure_pin_target_type(draft_nodes, target_node_id) do
    draft_nodes
    |> Enum.find(&(&1.id == target_node_id))
    |> case do
      %DocTreeNodeDraft{type: type} when type in [:page, :link] ->
        :ok

      _ ->
        {:error, {:custom, "Pin target must be a doc or link."}}
    end
  end

  defp cleanup_deleted_tree_nodes(_community, []), do: :ok

  defp cleanup_deleted_tree_nodes(%Community{} = community, deleted_nodes) do
    draft_node_ids = Enum.map(deleted_nodes, & &1.id)

    mappings =
      DocTreeNodePublishMapping
      |> where([m], m.community_id == ^community.id)
      |> where([m], m.draft_node_id in ^draft_node_ids)
      |> Repo.all()
      |> Map.new(&{&1.draft_node_id, &1})

    published_nodes =
      mappings
      |> Map.values()
      |> Enum.map(& &1.published_node_id)
      |> public_nodes_by_id(community)

    deleted_nodes
    |> Enum.sort_by(fn node -> if is_nil(node.parent_id), do: 1, else: 0 end)
    |> Enum.reduce_while(:ok, fn node, :ok ->
      mapping = Map.get(mappings, node.id)
      published_node = mapping && Map.get(published_nodes, mapping.published_node_id)

      with :ok <- maybe_delete_published_node(published_node),
           {:ok, _node} <- ORM.delete(node) do
        {:cont, :ok}
      else
        error -> {:halt, error}
      end
    end)
  end

  defp public_nodes_by_id([], _community), do: %{}

  defp public_nodes_by_id(ids, %Community{} = community) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.id in ^ids)
    |> Repo.all()
    |> Map.new(&{&1.id, &1})
  end

  defp maybe_delete_published_node(nil), do: :ok

  defp maybe_delete_published_node(%DocTreeNode{} = node) do
    case ORM.delete(node) do
      {:ok, _node} -> :ok
      error -> error
    end
  end

  defp publish_group_children(
         %Community{} = community,
         children,
         %DocTreeNode{} = group,
         user,
         context
       ) do
    children
    |> Enum.reduce_while({:ok, %{count: 0, pages: []}}, fn child, {:ok, acc} ->
      result =
        case child.type do
          :page -> publish_group_page(community, child, group, user, context)
          :link -> publish_group_link(community, child, group, context)
        end

      case result do
        {:ok, %DocTreeNode{type: :page} = page} ->
          {:cont, {:ok, %{acc | count: acc.count + 1, pages: [page | acc.pages]}}}

        {:ok, %DocTreeNode{}} ->
          {:cont, {:ok, %{acc | count: acc.count + 1}}}

        error ->
          {:halt, error}
      end
    end)
    |> case do
      {:ok, result} -> {:ok, %{result | pages: Enum.reverse(result.pages)}}
      error -> error
    end
  end

  defp publish_group_page(
         %Community{} = community,
         %DocTreeNodeDraft{} = draft_page,
         %DocTreeNode{} = published_group,
         %User{} = user,
         context
       ) do
    with {:ok, revision} <-
           CMS.Articles.publish_doc_draft_revision(community, draft_page.article_draft_id, user),
         {:ok, published_page} <-
           upsert_published_page(
             community,
             draft_page,
             published_group.id,
             revision.article_id,
             context
           ),
         {:ok, _page_mapping} <-
           upsert_mapping(
             community,
             draft_page,
             published_page,
             Map.get(context.draft_docs, draft_page.article_draft_id),
             revision.article_id,
             context
           ) do
      {:ok, published_page}
    end
  end

  defp publish_group_link(
         %Community{} = community,
         %DocTreeNodeDraft{} = draft_link,
         %DocTreeNode{} = published_group,
         context
       ) do
    with {:ok, published_link} <-
           upsert_published_link(community, draft_link, published_group.id, context),
         {:ok, _link_mapping} <-
           upsert_mapping(community, draft_link, published_link, nil, nil, context) do
      {:ok, published_link}
    end
  end

  defp upsert_published_pin(
         %Community{} = community,
         %DocTreeNodeDraft{} = draft_pin,
         published_target_id,
         context
       ) do
    case published_node_for_draft(community, draft_pin.id, context) do
      {:ok, published} ->
        ORM.update(published, published_attrs(draft_pin, nil, nil, nil, published_target_id))

      {:error, _} ->
        ORM.create(
          DocTreeNode,
          published_attrs(draft_pin, community.id, nil, nil, published_target_id)
        )
    end
  end

  defp upsert_published_group(
         %Community{} = community,
         %DocTreeNodeDraft{} = draft_group,
         context \\ nil
       ) do
    case published_node_for_draft(community, draft_group.id, context) do
      {:ok, published} ->
        ORM.update(published, published_attrs(draft_group, nil, nil))

      {:error, _} ->
        ORM.create(DocTreeNode, published_attrs(draft_group, community.id, nil))
    end
  end

  defp upsert_published_link(
         %Community{} = community,
         %DocTreeNodeDraft{} = draft_link,
         published_group_id,
         context
       ) do
    case published_node_for_draft(community, draft_link.id, context) do
      {:ok, published} ->
        ORM.update(published, published_attrs(draft_link, nil, published_group_id))

      {:error, _} ->
        ORM.create(
          DocTreeNode,
          published_attrs(draft_link, community.id, published_group_id)
        )
    end
  end

  defp upsert_published_page(
         %Community{} = community,
         %DocTreeNodeDraft{} = draft_page,
         published_group_id,
         published_doc_id,
         context \\ nil
       ) do
    case published_node_for_draft(community, draft_page.id, context) do
      {:ok, published} ->
        ORM.update(
          published,
          published_attrs(draft_page, nil, published_group_id, published_doc_id)
        )

      {:error, _} ->
        ORM.create(
          DocTreeNode,
          published_attrs(draft_page, community.id, published_group_id, published_doc_id)
        )
    end
  end

  defp published_node_for_draft(%Community{} = community, draft_node_id, nil) do
    with {:ok, mapping} <- mapping_for_draft(community, draft_node_id) do
      ORM.find(DocTreeNode, mapping.published_node_id)
    end
  end

  defp published_node_for_draft(%Community{}, draft_node_id, context) do
    with %DocTreeNodePublishMapping{} = mapping <- Map.get(context.mappings, draft_node_id),
         %DocTreeNode{} = published <- Map.get(context.published_nodes, mapping.published_node_id) do
      {:ok, published}
    else
      _ -> {:error, :not_found}
    end
  end

  defp published_attrs(
         %DocTreeNodeDraft{} = draft_node,
         community_id,
         parent_id,
         doc_id \\ nil,
         target_node_id \\ nil
       ) do
    draft_node
    |> Map.take(PublishedFields.node_fields())
    |> Map.merge(%{
      community_id: community_id || draft_node.community_id,
      parent_id: parent_id,
      doc_id: doc_id,
      target_node_id: target_node_id
    })
  end

  defp upsert_mapping(
         %Community{} = community,
         %DocTreeNodeDraft{} = draft_node,
         %DocTreeNode{} = published_node,
         draft_doc,
         published_doc_id,
         context \\ nil
       ) do
    attrs = %{
      community_id: community.id,
      draft_node_id: draft_node.id,
      published_node_id: published_node.id,
      draft_doc_id: draft_doc && draft_doc.id,
      published_doc_id: published_doc_id,
      draft_node_updated_at: draft_node.updated_at,
      draft_doc_content_hash: draft_doc && draft_doc.content_hash,
      visibility: :public,
      last_published_at: DateTime.utc_now(:second)
    }

    case mapping_for_upsert(community, draft_node.id, context) do
      {:ok, mapping} -> ORM.update(mapping, attrs)
      {:error, _} -> ORM.create(DocTreeNodePublishMapping, attrs)
    end
  end

  defp mapping_for_upsert(%Community{} = community, draft_node_id, nil),
    do: mapping_for_draft(community, draft_node_id)

  defp mapping_for_upsert(%Community{}, draft_node_id, context) do
    case Map.get(context.mappings, draft_node_id) do
      %DocTreeNodePublishMapping{} = mapping -> {:ok, mapping}
      nil -> {:error, :not_found}
    end
  end

  defp maybe_sync_cover(_community, _published_group, _published_page, false), do: {:ok, :skipped}

  defp maybe_sync_cover(
         %Community{} = community,
         %DocTreeNode{} = group,
         %DocTreeNode{} = page,
         true
       ) do
    CMS.DocCover.Sync.sync_published_page(community, group, page)
  end

  defp maybe_sync_cover_group(_community, _published_group, _pages, false), do: {:ok, :skipped}
  defp maybe_sync_cover_group(_community, _published_group, [], true), do: {:ok, :skipped}

  defp maybe_sync_cover_group(
         %Community{} = community,
         %DocTreeNode{} = group,
         pages,
         true
       ) do
    with {:ok, cover_group} <- CMS.DocCover.Sync.ensure_cover_group(community, group) do
      pages
      |> Enum.reduce_while({:ok, :synced}, fn page, {:ok, _acc} ->
        case CMS.DocCover.Sync.ensure_cover_item(community, cover_group, page) do
          {:ok, _item} -> {:cont, {:ok, :synced}}
          error -> {:halt, error}
        end
      end)
    end
  end

  defp ensure_public_mapping(%DocTreeNodePublishMapping{visibility: :public}), do: :ok

  defp ensure_public_mapping(%DocTreeNodePublishMapping{}),
    do: {:error, {:custom, "This doc is already draft."}}
end
