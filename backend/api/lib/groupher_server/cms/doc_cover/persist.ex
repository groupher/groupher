defmodule GroupherServer.CMS.DocCover.Persist do
  @moduledoc """
  Write operations for the save-immediate docs cover.

      command callback(draft id)
                |
                v
      doc_tree_nodes(stage=draft, node_id)
                |
                v
      doc_tree_nodes(stage=public, same node_id)
                |
                v
      doc_cover_cards/items/pinned_docs

  Public cover rows never reference draft nodes. If a draft node has not been
  published yet, writes fail with a product-facing warning error.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Persist
        -> Repo / external boundary
  """

  require GroupherServer.CMS.DocTree.Const
  require GroupherServer.CMS.Const

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.ErrorCat
  alias CMS.DocCover.Sync, as: CoverSync
  alias CMS.DocTree.ChangeDetection
  alias CMS.DocTree.Publish, as: DocTreePublish

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleRevision,
    Community,
    DocBranchVersion,
    DocCoverCard,
    DocCoverItem,
    DocCoverPinnedDoc,
    DocDraft,
    DocPublic,
    DocTreeNode
  }

  alias Helper.{ORM, T}

  @tree_node_type_page CMS.DocTree.Const.tree_node_type(:page)

  @doc """
  Adds one published Group as a Cover Card.

  Existing ancestor Cards reject the operation. Existing descendant Cards are
  replaced atomically and the new parent Card takes their earliest position.

  ## Examples

      Persist.add_card(community, group_node_id)
      #=> {:ok, %{id: card_id}}
  """
  @spec add_card(Community.t(), T.id()) :: T.domain_res(map())
  def add_card(%Community{} = community, draft_group_node_id) do
    with {:ok, published_group} <- resolve_published_group(community, draft_group_node_id),
         {:ok, leaves} <- published_leaves_for_group(community, draft_group_node_id),
         {:ok, _} <- ensure_has_leaves(leaves),
         {:ok, replacement_index} <- replace_descendant_cards(community, published_group),
         {:ok, cover_card} <- CoverSync.ensure_cover_card(community, published_group),
         {:ok, _} <- place_cover_card(community, cover_card, replacement_index) do
      {:ok, card_result(cover_card, published_group, replacement_index)}
    end
  end

  @doc """
  Removes one cover card by draft source node id.

  ## Examples

      Persist.remove_card(community, group_node_id)
      #=> {:ok, %{id: card_id}}
  """
  @spec remove_card(Community.t(), T.id()) :: T.domain_res(map())
  def remove_card(%Community{} = community, draft_group_node_id) do
    with {:ok, published_source} <- resolve_published_group(community, draft_group_node_id),
         {:ok, cover_card} <-
           ORM.find_by(DocCoverCard,
             community_id: community.id,
             group_node_id: published_source.id
           ),
         {:ok, _deleted} <- ORM.delete(cover_card) do
      {:ok, card_result(cover_card, published_source)}
    end
  end

  defp card_result(%DocCoverCard{} = card, published_group, index \\ nil) do
    %{
      id: card.id,
      group_node_id: published_group.node_id,
      index: index || card.index,
      title: published_group.title,
      appearance: card.appearance || %{}
    }
  end

  @doc """
  Updates cover-local visibility for one published page.

  ## Examples

      Persist.set_item_hidden(community, item_id, true)
      #=> {:ok, %DocCoverItem{}}
  """
  @spec set_item_hidden(Community.t(), T.id(), boolean()) ::
          T.domain_res(DocCoverItem.t())
  def set_item_hidden(%Community{} = community, cover_item_id, hidden)
      when is_boolean(hidden) do
    with {:ok, item} <- ORM.find_by(DocCoverItem, id: cover_item_id, community_id: community.id) do
      ORM.update(item, %{hidden: hidden})
    end
  end

  @doc """
  Updates cover-local appearance for one cover card.

  ## Examples

      Persist.update_card_appearance(community, card_id, %{light: %{}})
      #=> {:ok, %DocCoverCard{}}
  """
  @spec update_card_appearance(Community.t(), T.id(), map()) ::
          T.domain_res(DocCoverCard.t())
  def update_card_appearance(
        %Community{} = community,
        cover_card_id,
        appearance
      )
      when is_map(appearance) do
    with {:ok, group} <- ORM.find_by(DocCoverCard, id: cover_card_id, community_id: community.id) do
      ORM.update(group, %{appearance: appearance})
    end
  end

  @doc """
  Updates cover-local appearance for one cover item.

  ## Examples

      Persist.update_item_appearance(community, item_id, %{light: %{}})
      #=> {:ok, %DocCoverItem{}}
  """
  @spec update_item_appearance(Community.t(), T.id(), map()) ::
          T.domain_res(DocCoverItem.t())
  def update_item_appearance(
        %Community{} = community,
        cover_item_id,
        appearance
      )
      when is_map(appearance) do
    with {:ok, item} <- ORM.find_by(DocCoverItem, id: cover_item_id, community_id: community.id) do
      ORM.update(item, %{appearance: appearance})
    end
  end

  @doc """
  Reorders cover cards by cover card ids.

  ## Examples

      Persist.reorder_cards(community, card_ids)
      #=> {:ok, %{done: true}}
  """
  @spec reorder_cards(Community.t(), list(T.id())) :: T.domain_res(map())
  def reorder_cards(%Community{} = community, ids) when is_list(ids) do
    with {:ok, _} <- validate_unique_ids(ids, "Doc cover card order contains duplicate cards."),
         groups_by_id <- cover_cards_by_id(community, ids),
         {:ok, groups} <- ordered_cover_cards(groups_by_id, community, ids),
         {:ok, _} <- batch_reindex_groups(community, groups) do
      {:ok, %{done: true}}
    end
  end

  @doc """
  Reorders cover items inside one cover card by cover item ids.

  ## Examples

      Persist.reorder_items(community, card_id, item_ids)
      #=> {:ok, %{done: true}}
  """
  @spec reorder_items(Community.t(), T.id(), list(T.id())) :: T.domain_res(map())
  def reorder_items(%Community{} = community, cover_card_id, ids)
      when is_list(ids) do
    with {:ok, cover_card} <-
           ORM.find_by(DocCoverCard, id: cover_card_id, community_id: community.id),
         {:ok, _} <- validate_unique_ids(ids, "Doc cover item order contains duplicate items."),
         items_by_id <- cover_items_by_id(community, cover_card, ids),
         {:ok, items} <- ordered_cover_items(items_by_id, community, cover_card, ids),
         {:ok, _} <- batch_reindex_items(community, cover_card, items) do
      {:ok, %{done: true}}
    end
  end

  @doc """
  Pins one clean published page to the top cover area.

  ## Examples

      Persist.pin_doc(community, page_node_id)
      #=> {:ok, %DocCoverPinnedDoc{}}
  """
  @spec pin_doc(Community.t(), T.id()) :: T.domain_res(DocCoverPinnedDoc.t())
  def pin_doc(%Community{} = community, draft_node_id) do
    with {:ok, page} <- resolve_published_page(community, draft_node_id) do
      case ORM.find_by(DocCoverPinnedDoc, community_id: community.id, node_id: page.id) do
        {:ok, pinned_doc} ->
          {:ok, pinned_doc}

        {:error, _} ->
          create_pinned_doc(community, page)
      end
    end
  end

  defp create_pinned_doc(community, page) do
    case ensure_clean_published(community, page) do
      {:ok, _} ->
        ORM.create(DocCoverPinnedDoc, %{
          community_id: community.id,
          node_id: page.id,
          index: next_pinned_index(community),
          appearance: %{"light" => %{}, "dark" => %{}}
        })

      error ->
        error
    end
  end

  @doc """
  Removes one pinned cover doc by draft page id.

  ## Examples

      Persist.unpin_doc(community, page_node_id)
      #=> {:ok, %DocCoverPinnedDoc{}}
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

  ## Examples

      Persist.reorder_pinned_docs(community, node_ids)
      #=> {:ok, :pass}
  """
  @spec reorder_pinned_docs(Community.t(), list(T.id())) :: T.domain_res(map())
  def reorder_pinned_docs(%Community{} = community, node_ids)
      when is_list(node_ids) do
    pinned_docs =
      DocCoverPinnedDoc
      |> where([p], p.community_id == ^community.id)
      |> lock("FOR UPDATE")
      |> preload(:node)
      |> Repo.all()

    current_ids = Enum.map(pinned_docs, & &1.node.node_id)

    with {:ok, _} <- validate_complete_node_set(node_ids, current_ids) do
      pinned_by_node_id = Map.new(pinned_docs, &{&1.node.node_id, &1})
      ordered = Enum.map(node_ids, &Map.fetch!(pinned_by_node_id, to_string(&1)))
      reindex_pinned_docs(community, ordered)
    end
  end

  defp reindex_pinned_docs(community, pinned_docs) do
    case batch_reindex_pinned_docs(community, pinned_docs) do
      {:ok, _} -> {:ok, :pass}
      error -> error
    end
  end

  @doc """
  Updates the Light/Dark appearance for one pinned card.

  ## Examples

      Persist.update_pinned_doc_appearance(community, page_node_id, appearance)
      #=> {:ok, %DocCoverPinnedDoc{}}
  """
  @spec update_pinned_doc_appearance(Community.t(), T.id(), map()) ::
          T.domain_res(DocCoverPinnedDoc.t())
  def update_pinned_doc_appearance(
        %Community{} = community,
        draft_node_id,
        appearance
      )
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
      DocDraft
      |> join(:inner, [draft], article in Article, on: article.id == draft.article_id)
      |> join(:inner, [draft, _article], binding in ArticleBinding,
        on: binding.article_id == draft.article_id
      )
      |> where([_draft, _article, binding], binding.community_id == ^community.id)
      |> where([draft, _article, _binding], draft.branch_id == ^page.branch_id)
      |> where([draft, _article, _binding], draft.article_id == ^page.doc_id)
      |> limit(1)
      |> Repo.one()

    public_revision =
      ArticleRevision
      |> join(:inner, [revision], version in DocBranchVersion,
        on: version.revision_id == revision.id
      )
      |> join(:inner, [revision, version], public in DocPublic,
        on: public.branch_version_id == version.id
      )
      |> where([revision, _version, public], revision.article_id == ^page.doc_id)
      |> where([_revision, _version, public], public.branch_id == ^page.branch_id)
      |> limit(1)
      |> Repo.one()

    if is_nil(draft) or
         not ChangeDetection.draft_content_changed?(draft, public_revision) do
      {:ok, :pass}
    else
      {:error, ErrorCat.custom("Publish the latest doc changes before pinning it to cover.")}
    end
  end

  defp validate_complete_node_set(node_ids, current_ids) do
    requested = Enum.map(node_ids, &to_string/1)

    cond do
      length(requested) != length(Enum.uniq(requested)) ->
        {:error, ErrorCat.custom("Pinned doc order contains duplicate nodes.")}

      MapSet.new(requested) != MapSet.new(current_ids) ->
        {:error,
         ErrorCat.custom("Pinned doc order must contain the complete current collection.")}

      true ->
        {:ok, :pass}
    end
  end

  defp normalize_appearance(appearance) do
    light = Map.get(appearance, "light", Map.get(appearance, :light, %{})) || %{}
    dark = Map.get(appearance, "dark", Map.get(appearance, :dark, %{})) || %{}

    if is_map(light) and is_map(dark) do
      {:ok, %{"light" => light, "dark" => dark}}
    else
      {:error, ErrorCat.custom("Pinned doc appearance must contain Light and Dark maps.")}
    end
  end

  defp resolve_published_group(%Community{} = community, draft_node_id) do
    with {:ok, published} <- resolve_published_node(community, draft_node_id),
         true <- published.type == :group do
      {:ok, published}
    else
      false ->
        {:error, ErrorCat.custom("A Cover Card must reference a published Group.")}

      error ->
        error
    end
  end

  defp resolve_published_page(%Community{} = community, draft_node_id) do
    with {:ok, published} <- resolve_published_node(community, draft_node_id),
         {:ok, _} <-
           expect_type(published, @tree_node_type_page, "This doc has not been published yet.") do
      {:ok, published}
    end
  end

  defp resolve_published_node(%Community{} = community, draft_node_id) do
    case DocTreePublish.public_node_for_draft(community, draft_node_id) do
      {:ok, published} ->
        {:ok, published}

      {:error, _} ->
        {:error, ErrorCat.custom("Publish it before adding it to cover.")}
    end
  end

  defp expect_type(%DocTreeNode{type: type}, type, _message), do: {:ok, :pass}
  defp expect_type(_node, _type, message), do: {:error, ErrorCat.custom(message)}

  defp published_leaves_for_group(%Community{} = community, draft_group_node_id) do
    draft_nodes =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.stage == CMS.Const.stage(:draft))
      |> order_by([n], asc: n.index, asc: n.id)
      |> Repo.all()

    children_by_parent = Enum.group_by(draft_nodes, & &1.parent_node_id)

    draft_node_ids =
      children_by_parent
      |> descendant_nodes(to_string(draft_group_node_id), MapSet.new())
      |> Enum.filter(&(&1.type in [:page, :link]))
      |> Enum.map(& &1.node_id)

    leaves_by_node_id =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.stage == CMS.Const.stage(:public))
      |> where([n], n.type in [:page, :link])
      |> where([n], n.node_id in ^draft_node_ids)
      |> Repo.all()
      |> Map.new(&{&1.node_id, &1})

    leaves =
      Enum.flat_map(draft_node_ids, fn node_id ->
        leaves_by_node_id
        |> Map.get(node_id)
        |> List.wrap()
      end)

    {:ok, leaves}
  end

  defp descendant_nodes(children_by_parent, parent_node_id, seen) do
    if MapSet.member?(seen, parent_node_id) do
      []
    else
      seen = MapSet.put(seen, parent_node_id)

      children_by_parent
      |> Map.get(parent_node_id, [])
      |> Enum.flat_map(fn child ->
        [child | descendant_nodes(children_by_parent, child.node_id, seen)]
      end)
    end
  end

  defp replace_descendant_cards(%Community{} = community, %DocTreeNode{} = group_node) do
    # Recursive ancestor/descendant traversal is intentionally kept as a
    # parameterized CTE; it has no direct Ecto tree-query equivalent.
    result =
      Repo.query!(
        """
        WITH RECURSIVE
        ancestors(node_id, parent_node_id) AS (
          SELECT node.node_id, node.parent_node_id
          FROM cms.doc_tree_nodes AS node
          WHERE node.community_id = $1
            AND node.branch_id = $2
            AND node.stage = $3
            AND node.node_id = $4

          UNION

          SELECT parent.node_id, parent.parent_node_id
          FROM cms.doc_tree_nodes AS parent
          JOIN ancestors AS child ON parent.node_id = child.parent_node_id
          WHERE parent.community_id = $1
            AND parent.branch_id = $2
            AND parent.stage = $3
        ),
        descendants(node_id) AS (
          SELECT node.node_id
          FROM cms.doc_tree_nodes AS node
          WHERE node.community_id = $1
            AND node.branch_id = $2
            AND node.stage = $3
            AND node.node_id = $4

          UNION

          SELECT child.node_id
          FROM cms.doc_tree_nodes AS child
          JOIN descendants AS parent ON child.parent_node_id = parent.node_id
          WHERE child.community_id = $1
            AND child.branch_id = $2
            AND child.stage = $3
        ),
        related_nodes AS (
          SELECT node_id, 'ancestor' AS binding
          FROM ancestors
          WHERE node_id != $4

          UNION ALL

          SELECT node_id, 'descendant' AS binding
          FROM descendants
          WHERE node_id != $4
        )
        SELECT card.id, card."index", related.binding
        FROM related_nodes AS related
        JOIN cms.doc_tree_nodes AS node
          ON node.community_id = $1
         AND node.branch_id = $2
         AND node.stage = $3
         AND node.node_id = related.node_id
        JOIN cms.doc_cover_cards AS card
          ON card.community_id = $1
         AND card.group_node_id = node.id
        ORDER BY card."index", card.id
        """,
        [
          community.id,
          group_node.branch_id,
          Atom.to_string(CMS.Const.stage(:public)),
          group_node.node_id
        ]
      )

    if Enum.any?(result.rows, fn [_id, _index, binding] -> binding == "ancestor" end) do
      {:error, ErrorCat.custom("This Group is already represented by an ancestor Cover Card.")}
    else
      descendants = for [id, index, "descendant"] <- result.rows, do: {id, index}

      replacement_index =
        descendants
        |> Enum.map(&elem(&1, 1))
        |> Enum.min(fn -> nil end)

      descendant_ids = Enum.map(descendants, &elem(&1, 0))

      case descendant_ids do
        [] ->
          {:ok, replacement_index}

        ids ->
          {count, _} =
            DocCoverCard
            |> where([card], card.community_id == ^community.id and card.id in ^ids)
            |> Repo.delete_all()

          if count == length(ids) do
            {:ok, replacement_index}
          else
            {:error, ErrorCat.custom("Doc Cover Cards changed during replacement.")}
          end
      end
    end
  end

  defp ensure_has_leaves([]) do
    {:error, ErrorCat.custom("Publish a doc before adding this group to cover.")}
  end

  defp ensure_has_leaves(_leaves), do: {:ok, :pass}

  defp place_cover_card(_community, _cover_card, nil), do: {:ok, :pass}

  defp place_cover_card(%Community{} = community, cover_card, replacement_index) do
    cards =
      DocCoverCard
      |> where([card], card.community_id == ^community.id)
      |> order_by([card], asc: card.index, asc: card.id)
      |> Repo.all()
      |> Enum.reject(&(&1.id == cover_card.id))

    insert_index = max(0, min(replacement_index, length(cards)))
    {before, after_cards} = Enum.split(cards, insert_index)
    batch_reindex_groups(community, before ++ [cover_card] ++ after_cards)
  end

  defp cover_cards_by_id(%Community{} = community, ids) do
    DocCoverCard
    |> where([g], g.community_id == ^community.id)
    |> where([g], g.id in ^ids)
    |> lock("FOR UPDATE")
    |> Repo.all()
    |> Map.new(&{to_string(&1.id), &1})
  end

  defp ordered_cover_cards(groups_by_id, %Community{} = community, ids) do
    ids
    |> Enum.reduce_while({:ok, []}, fn id, {:ok, acc} ->
      case cover_card_by_id(groups_by_id, community, id) do
        {:ok, group} -> {:cont, {:ok, [group | acc]}}
        error -> {:halt, error}
      end
    end)
    |> reverse_result()
  end

  defp cover_card_by_id(groups_by_id, %Community{} = community, id) do
    case Map.fetch(groups_by_id, to_string(id)) do
      {:ok, group} -> {:ok, group}
      :error -> ORM.find_by(DocCoverCard, id: id, community_id: community.id)
    end
  end

  defp cover_items_by_id(%Community{} = community, %DocCoverCard{} = cover_card, ids) do
    DocCoverItem
    |> where([i], i.community_id == ^community.id)
    |> where([i], i.cover_card_id == ^cover_card.id)
    |> where([i], i.id in ^ids)
    |> lock("FOR UPDATE")
    |> Repo.all()
    |> Map.new(&{to_string(&1.id), &1})
  end

  defp ordered_cover_items(items_by_id, %Community{} = community, %DocCoverCard{} = group, ids) do
    ids
    |> Enum.reduce_while({:ok, []}, fn id, {:ok, acc} ->
      case cover_item_by_id(items_by_id, community, group, id) do
        {:ok, item} -> {:cont, {:ok, [item | acc]}}
        error -> {:halt, error}
      end
    end)
    |> reverse_result()
  end

  defp cover_item_by_id(
         items_by_id,
         %Community{} = community,
         %DocCoverCard{} = cover_card,
         id
       ) do
    case Map.fetch(items_by_id, to_string(id)) do
      {:ok, item} ->
        {:ok, item}

      :error ->
        ORM.find_by(DocCoverItem,
          id: id,
          community_id: community.id,
          cover_card_id: cover_card.id
        )
    end
  end

  # GraphQL IDs may arrive as integers or strings. Normalize them before checking
  # duplicates so equivalent values cannot target the same row twice in UPDATE FROM.
  defp validate_unique_ids(ids, message) do
    normalized_ids = Enum.map(ids, &to_string/1)

    if length(normalized_ids) == length(Enum.uniq(normalized_ids)) do
      {:ok, :pass}
    else
      {:error, ErrorCat.custom(message)}
    end
  end

  # Reindex helpers update one tenant-scoped collection in a single SQL statement.
  # The affected-row check below turns concurrent scope changes into a rollback.
  # Ecto API: https://hexdocs.pm/ecto/Ecto.Query.API.html#values/2 and
  # https://hexdocs.pm/ecto/Ecto.Repo.html#update_all/3.
  defp batch_reindex_groups(%Community{} = community, groups) do
    updates = reindex_values(groups)

    if updates == [] do
      {:ok, :pass}
    else
      query =
        from(cover_card in DocCoverCard,
          join: update in values(updates, %{id: :id, index: :integer}),
          on: update.id == cover_card.id,
          where: cover_card.community_id == ^community.id,
          update: [set: [index: update.index, updated_at: ^DateTime.utc_now(:second)]]
        )

      query
      |> Repo.update_all([])
      |> expect_reindexed_rows(length(updates), "Doc cover card order targets changed.")
    end
  end

  defp batch_reindex_items(
         %Community{} = community,
         %DocCoverCard{} = cover_card,
         items
       ) do
    updates = reindex_values(items)

    if updates == [] do
      {:ok, :pass}
    else
      query =
        from(cover_item in DocCoverItem,
          join: update in values(updates, %{id: :id, index: :integer}),
          on: update.id == cover_item.id,
          where: cover_item.community_id == ^community.id,
          where: cover_item.cover_card_id == ^cover_card.id,
          update: [set: [index: update.index, updated_at: ^DateTime.utc_now(:second)]]
        )

      query
      |> Repo.update_all([])
      |> expect_reindexed_rows(length(updates), "Doc cover item order targets changed.")
    end
  end

  defp batch_reindex_pinned_docs(%Community{} = community, pinned_docs) do
    updates = reindex_values(pinned_docs)

    if updates == [] do
      {:ok, :pass}
    else
      query =
        from(pinned_doc in DocCoverPinnedDoc,
          join: update in values(updates, %{id: :id, index: :integer}),
          on: update.id == pinned_doc.id,
          where: pinned_doc.community_id == ^community.id,
          update: [set: [index: update.index, updated_at: ^DateTime.utc_now(:second)]]
        )

      query
      |> Repo.update_all([])
      |> expect_reindexed_rows(length(updates), "Pinned doc order targets changed.")
    end
  end

  # Preserve caller order while building the typed values relation; indexes are
  # always contiguous and zero-based.
  defp reindex_values(records) do
    records
    |> Enum.with_index()
    |> Enum.map(fn {record, index} -> %{id: record.id, index: index} end)
  end

  # A successful batch must update every requested row. Anything less indicates
  # that the validated collection changed or escaped its tenant/group scope.
  defp expect_reindexed_rows({expected, _result}, expected, _message), do: {:ok, :pass}

  defp expect_reindexed_rows({_actual, _result}, _expected, message),
    do: {:error, ErrorCat.custom(message)}

  # The validation reducers prepend for linear accumulation; restore request order
  # before the records are converted into reindex columns.
  defp reverse_result({:ok, records}), do: {:ok, Enum.reverse(records)}
  defp reverse_result(error), do: error

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
