defmodule GroupherServer.CMS.DocCover.Writer do
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
      doc_cover_cards/items/pinned_docs

  Public cover rows never reference draft nodes. If a draft node has not been
  published yet, writes fail with a product-facing warning error.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Writer
        -> Repo / external boundary
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Accounts.Profiles.ErrorCat, as: AuthErrorCat

  require CMS.Const

  alias CMS.Model.{
    Community,
    DocCoverCard,
    DocCoverItem,
    DocSnapshot,
    Doc,
    DocCoverPinnedDoc,
    DocTreeNode
  }

  alias Helper.{ORM, T}

  @tree_node_type_page CMS.Const.tree_node_type(:page)

  @doc """
  Adds one published Group as a Cover Card.

  Existing ancestor Cards reject the operation. Existing descendant Cards are
  replaced atomically and the new parent Card takes their earliest position.
  """
  @spec add_card(Community.t(), T.id(), User.t()) :: T.domain_res(map())
  def add_card(%Community{} = community, draft_group_node_id, %User{} = actor) do
    with_docs_access(actor, community, fn ->
      Repo.transaction(fn ->
        with {:ok, published_group} <- resolve_published_group(community, draft_group_node_id),
             {:ok, leaves} <- published_leaves_for_group(community, draft_group_node_id),
             :ok <- ensure_has_leaves(leaves),
             {:ok, replacement_index} <-
               replace_descendant_cards(community, published_group),
             {:ok, cover_card} <-
               CoverSync.ensure_cover_card(community, published_group),
             :ok <- place_cover_card(community, cover_card, replacement_index) do
          card_result(cover_card, published_group, replacement_index)
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
      |> case do
        {:ok, cover_card} -> {:ok, cover_card}
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  def add_card(%Community{}, _draft_group_node_id, _actor), do: {:error, AuthErrorCat.account_login()}

  defp with_docs_access(%User{} = actor, %Community{} = community, fun) do
    with {:ok, _canonical} <- CMS.Gate.access_check(actor, :manage_docs, community) do
      fun.()
    end
  end

  @doc """
  Removes one cover card by draft source node id.
  """
  @spec remove_card(Community.t(), T.id(), User.t()) :: T.domain_res(map())
  def remove_card(%Community{} = community, draft_group_node_id, %User{} = actor) do
    with_docs_access(actor, community, fn ->
      with {:ok, published_source} <-
             resolve_published_group(community, draft_group_node_id),
           {:ok, cover_card} <-
             ORM.find_by(
               DocCoverCard,
               community_id: community.id,
               group_node_id: published_source.id
             ),
           {:ok, _deleted} <- ORM.delete(cover_card) do
        {:ok, card_result(cover_card, published_source)}
      end
    end)
  end

  def remove_card(%Community{}, _draft_group_node_id, _actor), do: {:error, AuthErrorCat.account_login()}

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
  """
  @spec set_item_hidden(Community.t(), T.id(), boolean(), User.t()) ::
          T.domain_res(DocCoverItem.t())
  def set_item_hidden(%Community{} = community, cover_item_id, hidden, %User{} = actor)
      when is_boolean(hidden) do
    with_docs_access(actor, community, fn ->
      with {:ok, item} <-
             ORM.find_by(DocCoverItem, id: cover_item_id, community_id: community.id) do
        ORM.update(item, %{hidden: hidden})
      end
    end)
  end

  @doc """
  Updates cover-local appearance for one cover card.
  """
  @spec update_card_appearance(Community.t(), T.id(), map(), User.t()) ::
          T.domain_res(DocCoverCard.t())
  def update_card_appearance(
        %Community{} = community,
        cover_card_id,
        appearance,
        %User{} = actor
      )
      when is_map(appearance) do
    with_docs_access(actor, community, fn ->
      with {:ok, group} <-
             ORM.find_by(DocCoverCard, id: cover_card_id, community_id: community.id) do
        ORM.update(group, %{appearance: appearance})
      end
    end)
  end

  @doc """
  Updates cover-local appearance for one cover item.
  """
  @spec update_item_appearance(Community.t(), T.id(), map(), User.t()) ::
          T.domain_res(DocCoverItem.t())
  def update_item_appearance(
        %Community{} = community,
        cover_item_id,
        appearance,
        %User{} = actor
      )
      when is_map(appearance) do
    with_docs_access(actor, community, fn ->
      with {:ok, item} <-
             ORM.find_by(DocCoverItem, id: cover_item_id, community_id: community.id) do
        ORM.update(item, %{appearance: appearance})
      end
    end)
  end

  @doc """
  Reorders cover cards by cover card ids.
  """
  @spec reorder_cards(Community.t(), list(T.id()), User.t()) :: T.domain_res(map())
  def reorder_cards(%Community{} = community, ids, %User{} = actor) when is_list(ids) do
    with_docs_access(actor, community, fn ->
      transact_done(fn ->
        with :ok <- validate_unique_ids(ids, "Doc cover card order contains duplicate cards."),
             groups_by_id <- cover_cards_by_id(community, ids),
             {:ok, groups} <- ordered_cover_cards(groups_by_id, community, ids),
             :ok <- batch_reindex_groups(community, groups) do
          {:ok, :pass}
        end
      end)
    end)
  end

  @doc """
  Reorders cover items inside one cover card by cover item ids.
  """
  @spec reorder_items(Community.t(), T.id(), list(T.id()), User.t()) :: T.domain_res(map())
  def reorder_items(%Community{} = community, cover_card_id, ids, %User{} = actor)
      when is_list(ids) do
    with_docs_access(actor, community, fn ->
      transact_done(fn ->
        with {:ok, cover_card} <-
               ORM.find_by(DocCoverCard, id: cover_card_id, community_id: community.id),
             :ok <- validate_unique_ids(ids, "Doc cover item order contains duplicate items."),
             items_by_id <- cover_items_by_id(community, cover_card, ids),
             {:ok, items} <- ordered_cover_items(items_by_id, community, cover_card, ids),
             :ok <- batch_reindex_items(community, cover_card, items) do
          {:ok, :pass}
        end
      end)
    end)
  end

  @doc """
  Pins one clean published page to the top cover area.
  """
  @spec pin_doc(Community.t(), T.id(), User.t()) :: T.domain_res(DocCoverPinnedDoc.t())
  def pin_doc(%Community{} = community, draft_node_id, %User{} = actor) do
    with_docs_access(actor, community, fn ->
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
    end)
  end

  @doc """
  Removes one pinned cover doc by draft page id.
  """
  @spec unpin_doc(Community.t(), T.id(), User.t()) :: T.domain_res(DocCoverPinnedDoc.t())
  def unpin_doc(%Community{} = community, draft_node_id, %User{} = actor) do
    with_docs_access(actor, community, fn ->
      with {:ok, page} <- resolve_published_page(community, draft_node_id),
           {:ok, pinned_doc} <-
             ORM.find_by(DocCoverPinnedDoc, community_id: community.id, node_id: page.id) do
        ORM.delete(pinned_doc)
      end
    end)
  end

  @doc """
  Reorders the complete pinned-doc collection by public node identifier.
  """
  @spec reorder_pinned_docs(Community.t(), list(T.id()), User.t()) :: T.domain_res(map())
  def reorder_pinned_docs(%Community{} = community, node_ids, %User{} = actor)
      when is_list(node_ids) do
    with_docs_access(actor, community, fn ->
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
    end)
  end

  @doc "Updates the Light/Dark appearance for one pinned card."
  @spec update_pinned_doc_appearance(Community.t(), T.id(), map(), User.t()) ::
          T.domain_res(DocCoverPinnedDoc.t())
  def update_pinned_doc_appearance(
        %Community{} = community,
        draft_node_id,
        appearance,
        %User{} = actor
      )
      when is_map(appearance) do
    with_docs_access(actor, community, fn ->
      with {:ok, page} <- resolve_published_page(community, draft_node_id),
           {:ok, pinned_doc} <-
             ORM.find_by(DocCoverPinnedDoc, community_id: community.id, node_id: page.id),
           {:ok, appearance} <- normalize_appearance(appearance) do
        ORM.update(pinned_doc, %{appearance: appearance})
      end
    end)
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
      DocSnapshot
      |> where([s], s.community_id == ^community.id)
      |> where([s], s.branch_id == ^page.branch_id)
      |> where([s], s.article_hash_id == ^page.doc_id)
      |> where([s], s.stage == CMS.Const.stage(:public))
      |> order_by([s], desc: s.revision_number, desc: s.id)
      |> limit(1)
      |> Repo.one()

    if is_nil(draft) or
         not ChangeDetection.draft_content_changed?(draft, latest_public_snapshot) do
      :ok
    else
      {:error,
       GroupherServer.ErrorCat.custom(
         "Publish the latest doc changes before pinning it to cover."
       )}
    end
  end

  defp validate_complete_node_set(node_ids, current_ids) do
    requested = Enum.map(node_ids, &to_string/1)

    cond do
      length(requested) != length(Enum.uniq(requested)) ->
        {:error, GroupherServer.ErrorCat.custom("Pinned doc order contains duplicate nodes.")}

      MapSet.new(requested) != MapSet.new(current_ids) ->
        {:error,
         GroupherServer.ErrorCat.custom(
           "Pinned doc order must contain the complete current collection."
         )}

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
      {:error,
       GroupherServer.ErrorCat.custom("Pinned doc appearance must contain Light and Dark maps.")}
    end
  end

  defp resolve_published_group(%Community{} = community, draft_node_id) do
    with {:ok, published} <- resolve_published_node(community, draft_node_id),
         true <- published.type == :group do
      {:ok, published}
    else
      false ->
        {:error, GroupherServer.ErrorCat.custom("A Cover Card must reference a published Group.")}

      error ->
        error
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
    case DocTreePublish.public_node_for_draft(community, draft_node_id) do
      {:ok, published} ->
        {:ok, published}

      {:error, _} ->
        {:error, GroupherServer.ErrorCat.custom("Publish it before adding it to cover.")}
    end
  end

  defp expect_type(%DocTreeNode{type: type}, type, _message), do: :ok
  defp expect_type(_node, _type, message), do: {:error, GroupherServer.ErrorCat.custom(message)}

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
          SELECT node_id, 'ancestor' AS relation
          FROM ancestors
          WHERE node_id != $4

          UNION ALL

          SELECT node_id, 'descendant' AS relation
          FROM descendants
          WHERE node_id != $4
        )
        SELECT card.id, card."index", related.relation
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

    if Enum.any?(result.rows, fn [_id, _index, relation] -> relation == "ancestor" end) do
      {:error,
       GroupherServer.ErrorCat.custom(
         "This Group is already represented by an ancestor Cover Card."
       )}
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

          if count == length(ids),
            do: {:ok, replacement_index},
            else:
              {:error,
               GroupherServer.ErrorCat.custom("Doc Cover Cards changed during replacement.")}
      end
    end
  end

  defp ensure_has_leaves([]),
    do:
      {:error, GroupherServer.ErrorCat.custom("Publish a doc before adding this group to cover.")}

  defp ensure_has_leaves(_leaves), do: :ok

  defp place_cover_card(_community, _cover_card, nil), do: :ok

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

    if length(normalized_ids) == length(Enum.uniq(normalized_ids)),
      do: :ok,
      else: {:error, GroupherServer.ErrorCat.custom(message)}
  end

  # Reindex helpers update one tenant-scoped collection in a single SQL statement.
  # The affected-row check below turns concurrent scope changes into a rollback.
  defp batch_reindex_groups(%Community{} = community, groups) do
    {ids, indexes} = reindex_columns(groups)

    """
    UPDATE cms.doc_cover_cards AS cover_card
    SET "index" = updates.new_index,
        updated_at = $4
    FROM UNNEST($1::bigint[], $2::integer[]) AS updates(id, new_index)
    WHERE cover_card.id = updates.id
      AND cover_card.community_id = $3
    """
    |> Repo.query([ids, indexes, community.id, DateTime.utc_now(:second)])
    |> expect_reindexed_rows(length(ids), "Doc cover card order targets changed.")
  end

  defp batch_reindex_items(
         %Community{} = community,
         %DocCoverCard{} = cover_card,
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
      AND cover_item.cover_card_id = $4
    """
    |> Repo.query([ids, indexes, community.id, cover_card.id, DateTime.utc_now(:second)])
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
    do: {:error, GroupherServer.ErrorCat.custom(message)}

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
