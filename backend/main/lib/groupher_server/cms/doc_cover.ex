defmodule GroupherServer.CMS.DocCover do
  @moduledoc """
  Public docs cover facade.

      dashboard side tree(draft ids)
                 |
                 | resolve through doc_tree_node_publish_mappings
                 v
      doc_cover_groups/items/pinned_items
                 |
                 v
      published doc_tree_nodes(type=page)
                 |
                 v
      public docs cover renderer

  The cover has no draft layer. Every write updates the public cover
  immediately, while unpublished draft nodes are rejected before they can be
  referenced by cover rows.
  """

  alias GroupherServer.CMS.DocCover.{Read, Sync, Write}
  alias GroupherServer.CMS.Model.{Community, DocCoverGroup, DocCoverItem, DocCoverPinnedItem}
  alias GroupherServer.CMS.Model.DocTreeNode
  alias Helper.T

  @doc """
  Reads the current docs cover projection.

  `view` only changes generated node hrefs:

      :public     -> public docs route
      :dashboard  -> dashboard editor route
  """
  @spec read(Community.t(), Read.view()) :: T.domain_res(map())
  def read(%Community{} = community, view \\ :public), do: Read.read(community, view)

  @doc """
  Adds one published side-tree group to the cover by draft group id.
  """
  @spec add_group(Community.t(), T.id()) :: T.domain_res(DocCoverGroup.t())
  def add_group(%Community{} = community, draft_group_id),
    do: Write.add_group(community, draft_group_id)

  @doc """
  Removes one cover group by draft group id.
  """
  @spec remove_group(Community.t(), T.id()) :: T.domain_res(DocCoverGroup.t())
  def remove_group(%Community{} = community, draft_group_id),
    do: Write.remove_group(community, draft_group_id)

  @doc """
  Sets the cover-local hidden flag for one published page by draft page id.
  """
  @spec set_item_hidden(Community.t(), T.id(), boolean()) :: T.domain_res(DocCoverItem.t())
  def set_item_hidden(%Community{} = community, draft_node_id, hidden) do
    Write.set_item_hidden(community, draft_node_id, hidden)
  end

  @doc """
  Reorders cover groups by cover group ids.
  """
  @spec reorder_groups(Community.t(), list(T.id())) :: T.domain_res(map())
  def reorder_groups(%Community{} = community, ids), do: Write.reorder_groups(community, ids)

  @doc """
  Reorders cover items inside one cover group by cover item ids.
  """
  @spec reorder_items(Community.t(), T.id(), list(T.id())) :: T.domain_res(map())
  def reorder_items(%Community{} = community, cover_group_id, ids) do
    Write.reorder_items(community, cover_group_id, ids)
  end

  @doc """
  Updates UI config for one cover group.
  """
  @spec update_group_ui_config(Community.t(), T.id(), map()) :: T.domain_res(DocCoverGroup.t())
  def update_group_ui_config(%Community{} = community, cover_group_id, ui_config) do
    Write.update_group_ui_config(community, cover_group_id, ui_config)
  end

  @doc """
  Updates UI config for one cover item.
  """
  @spec update_item_ui_config(Community.t(), T.id(), map()) :: T.domain_res(DocCoverItem.t())
  def update_item_ui_config(%Community{} = community, cover_item_id, ui_config) do
    Write.update_item_ui_config(community, cover_item_id, ui_config)
  end

  @doc """
  Pins one published page by draft page id.
  """
  @spec pin_item(Community.t(), T.id(), map()) :: T.domain_res(DocCoverPinnedItem.t())
  def pin_item(%Community{} = community, draft_node_id, ui_config \\ %{}) do
    Write.pin_item(community, draft_node_id, ui_config)
  end

  @doc """
  Removes one pinned cover item by draft page id.
  """
  @spec unpin_item(Community.t(), T.id()) :: T.domain_res(DocCoverPinnedItem.t())
  def unpin_item(%Community{} = community, draft_node_id),
    do: Write.unpin_item(community, draft_node_id)

  @doc """
  Updates the UI config for one pinned cover item by draft page id.
  """
  @spec update_pinned_ui_config(Community.t(), T.id(), map()) ::
          T.domain_res(DocCoverPinnedItem.t())
  def update_pinned_ui_config(%Community{} = community, draft_node_id, ui_config) do
    Write.update_pinned_ui_config(community, draft_node_id, ui_config)
  end

  @doc """
  Ensures a just-published page is represented in the cover.
  """
  @spec sync_published_page(Community.t(), DocTreeNode.t(), DocTreeNode.t()) ::
          T.domain_res(term())
  def sync_published_page(%Community{} = community, %DocTreeNode{} = group, %DocTreeNode{} = page) do
    Sync.sync_published_page(community, group, page)
  end
end
