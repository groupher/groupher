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

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.DocCover.{Query, Sync}

  alias CMS.DocCover.Commands.{
    AddCard,
    PinDoc,
    RemoveCard,
    ReorderCards,
    ReorderPinnedDocs,
    UnpinDoc,
    UpdateCardAppearance,
    UpdatePinnedDocAppearance
  }

  alias CMS.Model.{Community, DocCoverCard, DocCoverPinnedDoc, DocTreeNode}
  alias Helper.T

  @doc """
  Reads the current docs cover projection.

  `view` only changes generated node hrefs:

      :public     -> public docs route
      :dashboard  -> dashboard editor route

  ## Examples

      DocCover.read(community)
      #=> {:ok, %{cards: [], pinned_docs: []}}
  """
  @spec read(Community.t(), Query.view(), User.t() | nil) :: T.domain_res(map())
  def read(%Community{} = community, view \\ :public, actor \\ nil) do
    Query.read(community, view, actor)
  end

  @doc """
  Adds one published Group as a Cover Card by draft node id.

  ## Examples

      DocCover.add_card(community, group_node_id, actor, command_id)
      #=> {:ok, %DocCoverCard{}}
  """
  @spec add_card(Community.t(), T.id(), User.t(), Ecto.UUID.t()) :: T.domain_res(map())
  def add_card(%Community{} = community, draft_group_node_id, %User{} = actor, command_id) do
    AddCard.execute(community, draft_group_node_id, actor, command_id)
  end

  @doc """
  Removes one Cover Card by draft Group node id.

  ## Examples

      DocCover.remove_card(community, group_node_id, actor, command_id)
      #=> {:ok, %DocCoverCard{}}
  """
  @spec remove_card(Community.t(), T.id(), User.t(), Ecto.UUID.t()) :: T.domain_res(map())
  def remove_card(
        %Community{} = community,
        draft_group_node_id,
        %User{} = actor,
        command_id
      ) do
    RemoveCard.execute(community, draft_group_node_id, actor, command_id)
  end

  @doc """
  Reorders Cover Cards by Card ids.

  ## Examples

      DocCover.reorder_cards(community, card_ids, actor, command_id)
      #=> {:ok, %{done: true}}
  """
  @spec reorder_cards(Community.t(), list(T.id()), User.t(), Ecto.UUID.t()) :: T.domain_res(map())
  def reorder_cards(%Community{} = community, ids, %User{} = actor, command_id) do
    ReorderCards.execute(community, ids, actor, command_id)
  end

  @doc """
  Updates appearance for one Cover Card.

  ## Examples

      DocCover.update_card_appearance(community, card_id, appearance, actor, command_id)
      #=> {:ok, %DocCoverCard{}}
  """
  @spec update_card_appearance(Community.t(), T.id(), map(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(DocCoverCard.t())
  def update_card_appearance(
        %Community{} = community,
        cover_card_id,
        appearance,
        %User{} = actor,
        command_id
      ) do
    UpdateCardAppearance.execute(
      community,
      cover_card_id,
      appearance,
      actor,
      command_id
    )
  end

  @doc """
  Pins one published page by draft page id.

  ## Examples

      DocCover.pin_doc(community, page_node_id, actor, command_id)
      #=> {:ok, %DocCoverPinnedDoc{}}
  """
  @spec pin_doc(Community.t(), T.id(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(DocCoverPinnedDoc.t())
  def pin_doc(%Community{} = community, draft_node_id, %User{} = actor, command_id) do
    PinDoc.execute(community, draft_node_id, actor, command_id)
  end

  @doc """
  Removes one pinned cover item by draft page id.

  ## Examples

      DocCover.unpin_doc(community, page_node_id, actor, command_id)
      #=> {:ok, %DocCoverPinnedDoc{}}
  """
  @spec unpin_doc(Community.t(), T.id(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(DocCoverPinnedDoc.t())
  def unpin_doc(%Community{} = community, draft_node_id, %User{} = actor, command_id) do
    UnpinDoc.execute(community, draft_node_id, actor, command_id)
  end

  @doc """
  Reorders the complete pinned-doc collection by public node identifier.

  ## Examples

      DocCover.reorder_pinned_docs(community, node_ids, actor, command_id)
      #=> {:ok, %{done: true}}
  """
  @spec reorder_pinned_docs(Community.t(), list(T.id()), User.t(), Ecto.UUID.t()) ::
          T.domain_res(map())
  def reorder_pinned_docs(%Community{} = community, node_ids, %User{} = actor, command_id) do
    ReorderPinnedDocs.execute(community, node_ids, actor, command_id)
  end

  @doc """
  Updates the Light/Dark appearance for one pinned card.

  ## Examples

      DocCover.update_pinned_doc_appearance(community, node_id, appearance, actor, command_id)
      #=> {:ok, %DocCoverPinnedDoc{}}
  """
  @spec update_pinned_doc_appearance(Community.t(), T.id(), map(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(DocCoverPinnedDoc.t())
  def update_pinned_doc_appearance(
        %Community{} = community,
        draft_node_id,
        appearance,
        %User{} = actor,
        command_id
      ) do
    UpdatePinnedDocAppearance.execute(
      community,
      draft_node_id,
      appearance,
      actor,
      command_id
    )
  end

  @doc """
  Ensures a just-published page is represented in the cover.

  ## Examples

      DocCover.sync_published_page(community, group, page)
      #=> {:ok, value}
  """
  @spec sync_published_page(Community.t(), DocTreeNode.t(), DocTreeNode.t()) ::
          T.domain_res(term())
  def sync_published_page(%Community{} = community, %DocTreeNode{} = group, %DocTreeNode{} = page) do
    Sync.sync_published_page(community, group, page)
  end
end
