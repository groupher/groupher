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
      doc_cover_groups/items/pinned_items

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
    DocCoverPinnedItem,
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
    groups_by_id = cover_groups_by_id(community, ids)

    transact_done(fn ->
      ids
      |> Enum.with_index()
      |> Enum.reduce_while({:ok, []}, fn {id, index}, {:ok, acc} ->
        with {:ok, group} <- cover_group_by_id(groups_by_id, community, id),
             {:ok, group} <- ORM.update(group, %{index: index}) do
          {:cont, {:ok, [group | acc]}}
        else
          error -> {:halt, error}
        end
      end)
    end)
  end

  @doc """
  Reorders cover items inside one cover group by cover item ids.
  """
  @spec reorder_items(Community.t(), T.id(), list(T.id())) :: T.domain_res(map())
  def reorder_items(%Community{} = community, cover_group_id, ids) when is_list(ids) do
    with {:ok, cover_group} <-
           ORM.find_by(DocCoverGroup, id: cover_group_id, community_id: community.id) do
      items_by_id = cover_items_by_id(community, cover_group, ids)

      transact_done(fn ->
        ids
        |> Enum.with_index()
        |> Enum.reduce_while({:ok, []}, fn {id, index}, {:ok, acc} ->
          with {:ok, item} <- cover_item_by_id(items_by_id, community, cover_group, id),
               {:ok, item} <- ORM.update(item, %{index: index}) do
            {:cont, {:ok, [item | acc]}}
          else
            error -> {:halt, error}
          end
        end)
      end)
    end
  end

  @doc """
  Pins one published page to the top cover area.
  """
  @spec pin_item(Community.t(), T.id(), map()) :: T.domain_res(DocCoverPinnedItem.t())
  def pin_item(%Community{} = community, draft_node_id, ui_config \\ %{}) do
    with {:ok, page} <- resolve_published_page(community, draft_node_id) do
      case ORM.find_by(DocCoverPinnedItem, community_id: community.id, node_id: page.id) do
        {:ok, item} ->
          {:ok, item}

        {:error, _} ->
          ORM.create(DocCoverPinnedItem, %{
            community_id: community.id,
            node_id: page.id,
            index: next_pinned_index(community),
            ui_config: ui_config || %{}
          })
      end
    end
  end

  @doc """
  Removes one pinned cover item by draft page id.
  """
  @spec unpin_item(Community.t(), T.id()) :: T.domain_res(DocCoverPinnedItem.t())
  def unpin_item(%Community{} = community, draft_node_id) do
    with {:ok, page} <- resolve_published_page(community, draft_node_id),
         {:ok, item} <-
           ORM.find_by(DocCoverPinnedItem, community_id: community.id, node_id: page.id) do
      ORM.delete(item)
    end
  end

  @doc """
  Updates UI config for one pinned cover item by draft page id.
  """
  @spec update_pinned_ui_config(Community.t(), T.id(), map()) ::
          T.domain_res(DocCoverPinnedItem.t())
  def update_pinned_ui_config(%Community{} = community, draft_node_id, ui_config) do
    with {:ok, page} <- resolve_published_page(community, draft_node_id),
         {:ok, item} <-
           ORM.find_by(DocCoverPinnedItem, community_id: community.id, node_id: page.id) do
      ORM.update(item, %{ui_config: ui_config || %{}})
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
    |> Repo.all()
    |> Map.new(&{to_string(&1.id), &1})
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
    |> Repo.all()
    |> Map.new(&{to_string(&1.id), &1})
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
    DocCoverPinnedItem
    |> where([i], i.community_id == ^community.id)
    |> select([i], max(i.index))
    |> Repo.one()
    |> case do
      nil -> 0
      index -> index + 1
    end
  end
end
