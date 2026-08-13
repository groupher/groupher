defmodule GroupherServer.CMS.DocCover do
  @moduledoc """
  Public CMS boundary for the published docs-cover projection.

      dashboard side tree(draft ids)
                 |
                 | resolve same node_id at stage=public
                 v
      doc_cover_cards/items/pinned_docs
                 |
                 v
      published doc_tree_nodes(type=page)
                 |
                 v
      public docs cover renderer

  The cover has no draft layer. Every write updates the public cover
  immediately, while unpublished draft nodes are rejected before they can be
  referenced by cover rows.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> DocCover
        -> Repo / external boundary
  """

  alias GroupherServer.CMS.DocCover.{Read, Sync, Write}
  alias GroupherServer.CMS.Model.{Community, DocCoverPinnedDoc, DocCoverCard}
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
  Adds one published Group as a Cover Card by draft node id.
  """
  @spec add_card(Community.t(), T.id()) :: T.domain_res(map())
  def add_card(%Community{} = community, draft_group_node_id),
    do: Write.add_card(community, draft_group_node_id)

  @doc """
  Removes one Cover Card by draft Group node id.
  """
  @spec remove_card(Community.t(), T.id()) :: T.domain_res(map())
  def remove_card(%Community{} = community, draft_group_node_id),
    do: Write.remove_card(community, draft_group_node_id)

  @doc """
  Reorders Cover Cards by Card ids.
  """
  @spec reorder_cards(Community.t(), list(T.id())) :: T.domain_res(map())
  def reorder_cards(%Community{} = community, ids), do: Write.reorder_cards(community, ids)

  @doc """
  Updates appearance for one Cover Card.
  """
  @spec update_card_appearance(Community.t(), T.id(), map()) ::
          T.domain_res(DocCoverCard.t())
  def update_card_appearance(%Community{} = community, cover_card_id, appearance) do
    Write.update_card_appearance(community, cover_card_id, appearance)
  end

  @doc """
  Pins one published page by draft page id.
  """
  @spec pin_doc(Community.t(), T.id()) :: T.domain_res(DocCoverPinnedDoc.t())
  def pin_doc(%Community{} = community, draft_node_id) do
    Write.pin_doc(community, draft_node_id)
  end

  @doc """
  Removes one pinned cover item by draft page id.
  """
  @spec unpin_doc(Community.t(), T.id()) :: T.domain_res(DocCoverPinnedDoc.t())
  def unpin_doc(%Community{} = community, draft_node_id),
    do: Write.unpin_doc(community, draft_node_id)

  @doc """
  Reorders the complete pinned-doc collection by public node identifier.
  """
  @spec reorder_pinned_docs(Community.t(), list(T.id())) :: T.domain_res(map())
  def reorder_pinned_docs(%Community{} = community, node_ids),
    do: Write.reorder_pinned_docs(community, node_ids)

  @doc "Updates the Light/Dark appearance for one pinned card."
  @spec update_pinned_doc_appearance(Community.t(), T.id(), map()) ::
          T.domain_res(DocCoverPinnedDoc.t())
  def update_pinned_doc_appearance(%Community{} = community, draft_node_id, appearance) do
    Write.update_pinned_doc_appearance(community, draft_node_id, appearance)
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
