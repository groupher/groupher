defmodule GroupherServerWeb.Schema.CMS.Mutations.DocTree do
  @moduledoc """
  GraphQL mutations for community docs side-tree editing.

  Business position:

      Client
        -> Absinthe schema / DocTree
        -> resolver or domain context
        -> GraphQL response
  """
  use Helper.GqlSchemaSuite

  object :cms_doc_tree_mutations do
    @desc "create one recursive docs navigation node"
    field :create_doc_tree_node, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:base_revision, non_null(:integer))
      @desc "Immediate parent logical node id; null only for a root Tab."
      arg(:parent_node_id, :id)
      arg(:input, non_null(:doc_tree_node_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.create_doc_tree_node/3)
    end

    @desc "update a docs tree node"
    field :update_doc_tree_node, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:base_revision, non_null(:integer))
      arg(:patch, non_null(:doc_tree_node_patch_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.update_doc_tree_node/3)
    end

    @desc "update a docs draft document"
    field :update_doc_draft, :doc_draft do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:expected_version, non_null(:integer))
      arg(:title, :string)
      arg(:subtitle, :string)
      arg(:slug, :string)
      arg(:body_bag, :artiment_body_bag_input)

      middleware(M.Authorize, :login)
      middleware(M.BodyBagTrust)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.update_doc_draft/3)
    end

    @desc "save current docs draft as an article revision checkpoint"
    field :checkpoint_doc_draft_snapshot, :doc_snapshot do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.checkpoint_doc_draft_snapshot/3)
    end

    @desc "publish selected docs content and tree changes as one release"
    field :publish_doc_changes, :doc_publish_changes_payload do
      arg(:community, non_null(:string))
      arg(:input, :doc_publish_changes_input)
      arg(:mode, :doc_publish_mode, default_value: :with_cover_sync)

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.publish_doc_changes/3)
    end

    @desc "move one published docs page back to draft visibility"
    field :move_doc_to_draft, :move_doc_to_draft_payload do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.move_doc_to_draft/3)
    end

    @desc "create missing article drafts for every published Page in one navigation subtree"
    field :move_doc_tree_subtree_to_draft, :done_state do
      arg(:community, non_null(:string))
      arg(:node_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.move_doc_tree_subtree_to_draft/3)
    end

    @desc "restore a docs draft from an article revision"
    field :restore_doc_draft_snapshot, :doc_draft do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:snapshot_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.restore_doc_draft_snapshot/3)
    end

    @desc "delete a docs tree node"
    field :delete_doc_tree_node, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:base_revision, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.delete_doc_tree_node/3)
    end

    @desc "restore a docs tree item from product trash"
    field :restore_doc_tree_trash_item, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:base_revision, non_null(:integer))
      @desc "Replacement parent logical node id when the original parent no longer exists."
      arg(:target_parent_node_id, :id)
      arg(:target_index, :integer)

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.restore_doc_tree_trash_item/3)
    end

    @desc "duplicate a docs tree node"
    field :duplicate_doc_tree_node, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:base_revision, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.duplicate_doc_tree_node/3)
    end

    @desc "move a docs tree node"
    field :move_doc_tree_node, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:base_revision, non_null(:integer))
      @desc "Target parent logical node id; null only when moving a root Tab."
      arg(:target_parent_node_id, :id)
      arg(:target_index, :integer)

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.move_doc_tree_node/3)
    end

    @desc "add a published Group as a Cover Card"
    field :add_doc_cover_card, :doc_cover_card do
      arg(:community, non_null(:string))
      arg(:group_node_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.add_doc_cover_card/3)
    end

    @desc "remove a docs Cover Card"
    field :remove_doc_cover_card, :doc_cover_card do
      arg(:community, non_null(:string))
      arg(:group_node_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.remove_doc_cover_card/3)
    end

    @desc "reorder docs Cover Cards"
    field :reorder_doc_cover_cards, :done_state do
      arg(:community, non_null(:string))
      arg(:ids, non_null(list_of(non_null(:id))))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.reorder_doc_cover_cards/3)
    end

    @desc "update docs Cover Card appearance"
    field :update_doc_cover_card_appearance, :doc_cover_card do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:appearance, non_null(:json))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.update_doc_cover_card_appearance/3)
    end

    @desc "pin a published docs page to cover"
    field :pin_doc_to_cover, non_null(:doc_cover_pinned_doc) do
      arg(:community, non_null(:string))
      arg(:node_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.pin_doc_to_cover/3)
    end

    @desc "remove a published docs page from cover pins"
    field :unpin_doc_from_cover, non_null(:doc_cover_pinned_doc) do
      arg(:community, non_null(:string))
      arg(:node_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.unpin_doc_from_cover/3)
    end

    @desc "reorder the complete docs cover pin collection"
    field :reorder_doc_cover_pinned_docs, non_null(:done_state) do
      arg(:community, non_null(:string))
      arg(:node_ids, non_null(list_of(non_null(:id))))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.reorder_doc_cover_pinned_docs/3)
    end

    @desc "update a pinned docs cover card appearance"
    field :update_pinned_doc_appearance, non_null(:doc_cover_pinned_doc) do
      arg(:community, non_null(:string))
      arg(:node_id, non_null(:id))
      arg(:appearance, non_null(:json))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.update_pinned_doc_appearance/3)
    end
  end
end
