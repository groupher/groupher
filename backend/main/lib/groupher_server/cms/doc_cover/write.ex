defmodule GroupherServer.CMS.DocCover.Write do
  @moduledoc """
  Write operations for the save-immediate docs cover.

      dashboard action(draft id)
                |
                v
      doc_tree_nodes(stage=draft, node_id)
                |
                v
      doc_tree_nodes(stage=public, same node_id)
                |
                v
      doc_cover_groups/items/pinned_docs

  Public cover rows never reference draft nodes. If a draft node has not been
  published yet, writes fail with a product-facing warning error.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  require CMS.Const

  alias CMS.Model.{
    Community,
    DocCoverGroup,
    DocCoverItem,
    ArticleSnapshot,
    Doc,
    DocCoverPinnedDoc,
    DocTreeNode
  }

  alias Helper.{ORM, T}

  @tree_node_type_group CMS.Const.tree_node_type(:group)
  @tree_node_type_page CMS.Const.tree_node_type(:page)

  @doc """
  Adds one published side-tree group to the cover and seeds its published pages.
  """
  @spec add_group(Community.t(), T.id()) :: T.domain_res(DocCoverGroup.t())
  def add_group(%Community{} = community, draft_group_id) do
    with {:ok, published_group} <- resolve_published_group(community, draft_group_id),
         {:ok, pages} <- published_pages_for_draft_group(community, draft_group_id),
         :ok <- ensure_has_pages(pages),
         {:ok, cover_group} <- CMS.DocCover.Sync.ensure_cover_group(community, published_group),
         {:ok, _items} <- seed_items(community, cover_group, pages) do
      {:ok, cover_group}
    end
  end

  @doc """
  Removes one cover group by draft group id.
  """
  @spec remove_group(Community.t(), T.id()) :: T.domain_res(DocCoverGroup.t())
  def remove_group(%Community{} = community, draft_group_id) do
    with {:ok, published_group} <- resolve_published_group(community, draft_group_id),
         {:ok, cover_group} <-
           ORM.find_by(DocCoverGroup, community_id: community.id, group_id: published_group.id) do
      ORM.delete(cover_group)
    end
  end

  @doc """
  Updates cover-local visibility for one published page.
  """
  @spec set_item_hidden(Community.t(), T.id(), boolean()) :: T.domain_res(DocCoverItem.t())
  def set_item_hidden(%Community{} = community, draft_node_id, hidden) when is_boolean(hidden) do
    with {:ok, page} <- resolve_published_page(community, draft_node_id),
         {:ok, cover_group} <-
           ORM.find_by(DocCoverGroup,
             community_id: community.id,
             group_id: public_group_row_id(community, page.group_id)
           ),
         {:ok, item} <- ensure_cover_item(community, cover_group, page) do
      ORM.update(item, %{hidden: hidden})
    end
  end

  @doc """
  Updates cover-local UI config for one cover group.
  """
  @spec update_group_ui_config(Community.t(), T.id(), map()) :: T.domain_res(DocCoverGroup.t())
  def update_group_ui_config(%Community{} = community, cover_group_id, ui_config)
      when is_map(ui_config) do
    with {:ok, group} <-
           ORM.find_by(DocCoverGroup, id: cover_group_id, community_id: community.id) do
      ORM.update(group, %{ui_config: ui_config})
    end
  end

  @doc """
  Updates cover-local UI config for one cover item.
  """
  @spec update_item_ui_config(Community.t(), T.id(), map()) :: T.domain_res(DocCoverItem.t())
  def update_item_ui_config(%Community{} = community, cover_item_id, ui_config)
      when is_map(ui_config) do
    with {:ok, item} <- ORM.find_by(DocCoverItem, id: cover_item_id, community_id: community.id) do
      ORM.update(item, %{ui_config: ui_config})
    end
  end

  @doc """
  Reorders cover groups by cover group ids.
  """
  @spec reorder_groups(Community.t(), list(T.id())) :: T.domain_res(map())
  def reorder_groups(%Community{} = community, ids) when is_list(ids) do
    transact_done(fn ->
      with :ok <- validate_unique_ids(ids, "Doc cover group order contains duplicate groups."),
           groups_by_id <- cover_groups_by_id(community, ids),
           {:ok, groups} <- ordered_cover_groups(groups_by_id, community, ids),
           :ok <- batch_reindex_groups(community, groups) do
        {:ok, :pass}
      end
    end)
  end

  @doc """
  Reorders cover items inside one cover group by cover item ids.
  """
  @spec reorder_items(Community.t(), T.id(), list(T.id())) :: T.domain_res(map())
  def reorder_items(%Community{} = community, cover_group_id, ids) when is_list(ids) do
    transact_done(fn ->
      with {:ok, cover_group} <-
             ORM.find_by(DocCoverGroup, id: cover_group_id, community_id: community.id),
           :ok <- validate_unique_ids(ids, "Doc cover item order contains duplicate items."),
           items_by_id <- cover_items_by_id(community, cover_group, ids),
           {:ok, items} <- ordered_cover_items(items_by_id, community, cover_group, ids),
           :ok <- batch_reindex_items(community, cover_group, items) do
        {:ok, :pass}
      end
    end)
  end

  @doc """
  Pins one clean published page to the top cover area.
  """
  @spec pin_doc(Community.t(), T.id()) :: T.domain_res(DocCoverPinnedDoc.t())
  def pin_doc(%Community{} = community, draft_node_id) do
    with {:ok, page} <- resolve_published_page(community, draft_node_id) do
      case ORM.find_by(DocCoverPinnedDoc, community_id: community.id, node_id: page.id) do
        {:ok, pinned_doc} ->
          {:ok, pinned_doc}

        {:error, _} ->
          with :ok <- ensure_clean_published(community, page) do
            ORM.create(DocCoverPinnedDoc, %{
              community_id: community.id,
              node_id: page.id,
              index: next_pinned_index(community),
              appearance: %{"light" => %{}, "dark" => %{}}
            })
          end
      end
    end
  end

  @doc """
  Removes one pinned cover doc by draft page id.
  """
  @spec unpin_doc(Community.t(), T.id()) :: T.domain_res(DocCoverPinnedDoc.t())
  def unpin_doc(%Community{} = community, draft_node_id) do
    with {:ok, page} <- resolve_published_page(community, draft_node_id),
         {:ok, pinned_doc} <-
           ORM.find_by(DocCoverPinnedDoc, community_id: community.id, node_id: page.id) do
      ORM.delete(pinned_doc)
    end
  end

  @doc """
  Reorders the complete pinned-doc collection by public node identifier.
  """
  @spec reorder_pinned_docs(Community.t(), list(T.id())) :: T.domain_res(map())
  def reorder_pinned_docs(%Community{} = community, node_ids) when is_list(node_ids) do
    transact_done(fn ->
      pinned_docs =
        DocCoverPinnedDoc
        |> where([p], p.community_id == ^community.id)
        |> lock("FOR UPDATE")
        |> preload(:node)
        |> Repo.all()

      current_ids = Enum.map(pinned_docs, & &1.node.node_id)

      with :ok <- validate_complete_node_set(node_ids, current_ids) do
        pinned_by_node_id = Map.new(pinned_docs, &{&1.node.node_id, &1})
        pinned_docs = Enum.map(node_ids, &Map.fetch!(pinned_by_node_id, to_string(&1)))

        case batch_reindex_pinned_docs(community, pinned_docs) do
          :ok -> {:ok, :pass}
          error -> error
        end
      end
    end)
  end

  @doc "Updates the Light/Dark appearance for one pinned card."
  @spec update_pinned_doc_appearance(Community.t(), T.id(), map()) ::
          T.domain_res(DocCoverPinnedDoc.t())
  def update_pinned_doc_appearance(%Community{} = community, draft_node_id, appearance)
      when is_map(appearance) do
    with {:ok, page} <- resolve_published_page(community, draft_node_id),
         {:ok, pinned_doc} <-
           ORM.find_by(DocCoverPinnedDoc, community_id: community.id, node_id: page.id),
         {:ok, appearance} <- normalize_appearance(appearance) do
      ORM.update(pinned_doc, %{appearance: appearance})
    end
  end

  defp ensure_clean_published(%Community{} = community, page) do
    draft =
      Doc
      |> where([d], d.community_id == ^community.id)
      |> where([d], d.branch_id == ^page.branch_id)
      |> where([d], d.article_hash_id == ^page.doc_id)
      |> where([d], d.stage == CMS.Const.stage(:draft))
      |> limit(1)
      |> Repo.one()

    latest_public_snapshot =
      ArticleSnapshot
      |> where([s], s.community_id == ^community.id)
      |> where([s], s.branch_id == ^page.branch_id)
      |> where([s], s.article_hash_id == ^page.doc_id)
      |> where([s], s.thread == :doc)
      |> where([s], s.stage == CMS.Const.stage(:public))
      |> order_by([s], desc: s.revision_number, desc: s.id)
      |> limit(1)
      |> Repo.one()

    if is_nil(draft) or
         not CMS.DocTree.ChangeDetection.draft_content_changed?(draft, latest_public_snapshot) do
      :ok
    else
      {:error, {:custom, "Publish the latest doc changes before pinning it to cover."}}
    end
  end

  defp validate_complete_node_set(node_ids, current_ids) do
    requested = Enum.map(node_ids, &to_string/1)

    cond do
      length(requested) != length(Enum.uniq(requested)) ->
        {:error, {:custom, "Pinned doc order contains duplicate nodes."}}

      MapSet.new(requested) != MapSet.new(current_ids) ->
        {:error, {:custom, "Pinned doc order must contain the complete current collection."}}

      true ->
        :ok
    end
  end

  defp normalize_appearance(appearance) do
    light = Map.get(appearance, "light", Map.get(appearance, :light, %{})) || %{}
    dark = Map.get(appearance, "dark", Map.get(appearance, :dark, %{})) || %{}

    if is_map(light) and is_map(dark) do
      {:ok, %{"light" => light, "dark" => dark}}
    else
      {:error, {:custom, "Pinned doc appearance must contain Light and Dark maps."}}
    end
  end

  defp resolve_published_group(%Community{} = community, draft_group_id) do
    with {:ok, published} <- resolve_published_node(community, draft_group_id),
         :ok <-
           expect_type(published, @tree_node_type_group, "This group has not been published yet.") do
      {:ok, published}
    end
  end

  defp resolve_published_page(%Community{} = community, draft_node_id) do
    with {:ok, published} <- resolve_published_node(community, draft_node_id),
         :ok <-
           expect_type(published, @tree_node_type_page, "This doc has not been published yet.") do
      {:ok, published}
    end
  end

  defp resolve_published_node(%Community{} = community, draft_node_id) do
    case CMS.DocTree.Publish.public_node_for_draft(community, draft_node_id) do
      {:ok, published} -> {:ok, published}
      {:error, _} -> {:error, {:custom, "Publish it before adding it to cover."}}
    end
  end

  defp expect_type(%DocTreeNode{type: type}, type, _message), do: :ok
  defp expect_type(_node, _type, message), do: {:error, {:custom, message}}

  defp published_pages_for_draft_group(%Community{} = community, draft_group_id) do
    draft_node_ids =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> where([n], n.group_id == ^to_string(draft_group_id))
      |> where([n], n.type == @tree_node_type_page)
      |> order_by([n], asc: n.index, asc: n.id)
      |> select([n], n.node_id)
      |> Repo.all()

    pages_by_node_id =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.stage == CMS.Const.stage(:public))
      |> where([n], n.type == @tree_node_type_page)
      |> where([n], n.node_id in ^draft_node_ids)
      |> Repo.all()
      |> Map.new(&{&1.node_id, &1})

    pages =
      Enum.flat_map(draft_node_ids, fn node_id ->
        pages_by_node_id
        |> Map.get(node_id)
        |> List.wrap()
      end)

    {:ok, pages}
  end

  defp ensure_has_pages([]),
    do: {:error, {:custom, "Publish a doc before adding this group to cover."}}

  defp ensure_has_pages(_pages), do: :ok

  defp cover_groups_by_id(%Community{} = community, ids) do
    DocCoverGroup
    |> where([g], g.community_id == ^community.id)
    |> where([g], g.id in ^ids)
    |> lock("FOR UPDATE")
    |> Repo.all()
    |> Map.new(&{to_string(&1.id), &1})
  end

  defp ordered_cover_groups(groups_by_id, %Community{} = community, ids) do
    ids
    |> Enum.reduce_while({:ok, []}, fn id, {:ok, acc} ->
      case cover_group_by_id(groups_by_id, community, id) do
        {:ok, group} -> {:cont, {:ok, [group | acc]}}
        error -> {:halt, error}
      end
    end)
    |> reverse_result()
  end

  defp cover_group_by_id(groups_by_id, %Community{} = community, id) do
    case Map.fetch(groups_by_id, to_string(id)) do
      {:ok, group} -> {:ok, group}
      :error -> ORM.find_by(DocCoverGroup, id: id, community_id: community.id)
    end
  end

  defp cover_items_by_id(%Community{} = community, %DocCoverGroup{} = cover_group, ids) do
    DocCoverItem
    |> where([i], i.community_id == ^community.id)
    |> where([i], i.cover_group_id == ^cover_group.id)
    |> where([i], i.id in ^ids)
    |> lock("FOR UPDATE")
    |> Repo.all()
    |> Map.new(&{to_string(&1.id), &1})
  end

  defp ordered_cover_items(items_by_id, %Community{} = community, %DocCoverGroup{} = group, ids) do
    ids
    |> Enum.reduce_while({:ok, []}, fn id, {:ok, acc} ->
      case cover_item_by_id(items_by_id, community, group, id) do
        {:ok, item} -> {:cont, {:ok, [item | acc]}}
        error -> {:halt, error}
      end
    end)
    |> reverse_result()
  end

  defp cover_item_by_id(items_by_id, %Community{} = community, %DocCoverGroup{} = cover_group, id) do
    case Map.fetch(items_by_id, to_string(id)) do
      {:ok, item} ->
        {:ok, item}

      :error ->
        ORM.find_by(DocCoverItem,
          id: id,
          community_id: community.id,
          cover_group_id: cover_group.id
        )
    end
  end

  defp public_group_row_id(%Community{} = community, group_node_id) do
    case CMS.DocTree.Publish.public_node_for_draft(community, group_node_id) do
      {:ok, group} -> group.id
      _ -> nil
    end
  end

  defp seed_items(%Community{} = community, %DocCoverGroup{} = cover_group, pages) do
    pages
    |> Enum.reduce_while({:ok, []}, fn page, {:ok, acc} ->
      case ensure_cover_item(community, cover_group, page) do
        {:ok, item} -> {:cont, {:ok, [item | acc]}}
        error -> {:halt, error}
      end
    end)
  end

  defp ensure_cover_item(
         %Community{} = community,
         %DocCoverGroup{} = cover_group,
         %DocTreeNode{type: @tree_node_type_page} = page
       ) do
    CMS.DocCover.Sync.ensure_cover_item(community, cover_group, page)
  end

  # GraphQL IDs may arrive as integers or strings. Normalize them before checking
  # duplicates so equivalent values cannot target the same row twice in UPDATE FROM.
  defp validate_unique_ids(ids, message) do
    normalized_ids = Enum.map(ids, &to_string/1)

    if length(normalized_ids) == length(Enum.uniq(normalized_ids)),
      do: :ok,
      else: {:error, {:custom, message}}
  end

  # Reindex helpers update one tenant-scoped collection in a single SQL statement.
  # The affected-row check below turns concurrent scope changes into a rollback.
  defp batch_reindex_groups(%Community{} = community, groups) do
    {ids, indexes} = reindex_columns(groups)

    """
    UPDATE cms.doc_cover_groups AS cover_group
    SET "index" = updates.new_index,
        updated_at = $4
    FROM UNNEST($1::bigint[], $2::integer[]) AS updates(id, new_index)
    WHERE cover_group.id = updates.id
      AND cover_group.community_id = $3
    """
    |> Repo.query([ids, indexes, community.id, DateTime.utc_now(:second)])
    |> expect_reindexed_rows(length(ids), "Doc cover group order targets changed.")
  end

  defp batch_reindex_items(
         %Community{} = community,
         %DocCoverGroup{} = cover_group,
         items
       ) do
    {ids, indexes} = reindex_columns(items)

    """
    UPDATE cms.doc_cover_items AS cover_item
    SET "index" = updates.new_index,
        updated_at = $5
    FROM UNNEST($1::bigint[], $2::integer[]) AS updates(id, new_index)
    WHERE cover_item.id = updates.id
      AND cover_item.community_id = $3
      AND cover_item.cover_group_id = $4
    """
    |> Repo.query([ids, indexes, community.id, cover_group.id, DateTime.utc_now(:second)])
    |> expect_reindexed_rows(length(ids), "Doc cover item order targets changed.")
  end

  defp batch_reindex_pinned_docs(%Community{} = community, pinned_docs) do
    {ids, indexes} = reindex_columns(pinned_docs)

    """
    UPDATE cms.doc_cover_pinned_docs AS pinned_doc
    SET "index" = updates.new_index,
        updated_at = $4
    FROM UNNEST($1::bigint[], $2::integer[]) AS updates(id, new_index)
    WHERE pinned_doc.id = updates.id
      AND pinned_doc.community_id = $3
    """
    |> Repo.query([ids, indexes, community.id, DateTime.utc_now(:second)])
    |> expect_reindexed_rows(length(ids), "Pinned doc order targets changed.")
  end

  # Preserve caller order while splitting records into the parallel arrays expected
  # by PostgreSQL UNNEST; indexes are always contiguous and zero-based.
  defp reindex_columns(records) do
    records
    |> Enum.with_index()
    |> Enum.map(fn {record, index} -> {record.id, index} end)
    |> Enum.unzip()
  end

  # A successful batch must update every requested row. Anything less indicates
  # that the validated collection changed or escaped its tenant/group scope.
  defp expect_reindexed_rows({:ok, %{num_rows: expected}}, expected, _message), do: :ok

  defp expect_reindexed_rows({:ok, _result}, _expected, message),
    do: {:error, {:custom, message}}

  defp expect_reindexed_rows({:error, reason}, _expected, _message), do: {:error, reason}

  # The validation reducers prepend for linear accumulation; restore request order
  # before the records are converted into reindex columns.
  defp reverse_result({:ok, records}), do: {:ok, Enum.reverse(records)}
  defp reverse_result(error), do: error

  defp transact_done(fun) do
    Repo.transaction(fn ->
      case fun.() do
        {:ok, _items} -> %{done: true}
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
    |> case do
      {:ok, payload} -> {:ok, payload}
      {:error, reason} -> {:error, reason}
    end
  end

  defp next_pinned_index(%Community{} = community) do
    DocCoverPinnedDoc
    |> where([i], i.community_id == ^community.id)
    |> select([i], max(i.index))
    |> Repo.one()
    |> case do
      nil -> 0
      index -> index + 1
    end
  end
end
