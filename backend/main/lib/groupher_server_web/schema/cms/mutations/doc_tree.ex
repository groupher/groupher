defmodule GroupherServerWeb.Schema.CMS.Mutations.DocTree do
  @moduledoc """
  GraphQL mutations for community docs side-tree editing.
  """
  use Helper.GqlSchemaSuite

  object :cms_doc_tree_mutations do
    @desc "create a docs tree group"
    field :create_doc_tree_group, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:base_revision, non_null(:integer))
      arg(:input, non_null(:doc_tree_node_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.create_doc_tree_group/3)
    end

    @desc "create a docs tree page"
    field :create_doc_tree_page, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:base_revision, non_null(:integer))
      arg(:input, non_null(:doc_tree_node_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.create_doc_tree_page/3)
    end

    @desc "create a docs tree quick link"
    field :create_doc_tree_link, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:base_revision, non_null(:integer))
      arg(:input, non_null(:doc_tree_node_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.create_doc_tree_link/3)
    end

    @desc "create a docs tree top pin link"
    field :create_doc_tree_pin, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:base_revision, non_null(:integer))
      arg(:input, non_null(:doc_tree_node_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.create_doc_tree_pin/3)
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
      arg(:title, :string)
      arg(:subtitle, :string)
      arg(:slug, :string)
      arg(:body, :string)

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.update_doc_draft/3)
    end

    @desc "save current docs draft as an article revision checkpoint"
    field :checkpoint_doc_draft_snapshot, :article_snapshot do
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

    @desc "move one docs side-tree group and its children back to draft visibility"
    field :move_doc_tree_group_to_draft, :done_state do
      arg(:community, non_null(:string))
      arg(:group_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.move_doc_tree_group_to_draft/3)
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
      arg(:target_group_id, :id)
      arg(:target_index, :integer)

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.move_doc_tree_node/3)
    end

    @desc "add a published docs side-tree group to cover"
    field :add_doc_cover_group, :doc_cover_group do
      arg(:community, non_null(:string))
      arg(:group_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.add_doc_cover_group/3)
    end

    @desc "remove a docs side-tree group from cover"
    field :remove_doc_cover_group, :doc_cover_group do
      arg(:community, non_null(:string))
      arg(:group_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.remove_doc_cover_group/3)
    end

    @desc "toggle a docs page visibility in its cover group"
    field :set_doc_cover_item_hidden, :doc_cover_item do
      arg(:community, non_null(:string))
      arg(:node_id, non_null(:id))
      arg(:hidden, non_null(:boolean))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.set_doc_cover_item_hidden/3)
    end

    @desc "reorder docs cover groups"
    field :reorder_doc_cover_groups, :done_state do
      arg(:community, non_null(:string))
      arg(:ids, non_null(list_of(non_null(:id))))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.reorder_doc_cover_groups/3)
    end

    @desc "reorder docs cover items inside a cover group"
    field :reorder_doc_cover_items, :done_state do
      arg(:community, non_null(:string))
      arg(:cover_group_id, non_null(:id))
      arg(:ids, non_null(list_of(non_null(:id))))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.reorder_doc_cover_items/3)
    end

    @desc "update docs cover group UI config"
    field :update_doc_cover_group_ui_config, :doc_cover_group do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:ui_config, non_null(:json))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.update_doc_cover_group_ui_config/3)
    end

    @desc "update docs cover item UI config"
    field :update_doc_cover_item_ui_config, :doc_cover_item do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:ui_config, non_null(:json))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.update_doc_cover_item_ui_config/3)
    end

    @desc "pin a published docs page to cover"
    field :pin_doc_cover_item, :doc_cover_pinned_item do
      arg(:community, non_null(:string))
      arg(:node_id, non_null(:id))
      arg(:ui_config, :json)

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.pin_doc_cover_item/3)
    end

    @desc "remove a published docs page from cover pins"
    field :unpin_doc_cover_item, :doc_cover_pinned_item do
      arg(:community, non_null(:string))
      arg(:node_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.unpin_doc_cover_item/3)
    end

    @desc "update a pinned docs cover UI config"
    field :update_doc_cover_pinned_ui_config, :doc_cover_pinned_item do
      arg(:community, non_null(:string))
      arg(:node_id, non_null(:id))
      arg(:ui_config, non_null(:json))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.update_doc_cover_pinned_ui_config/3)
    end
  end
end
