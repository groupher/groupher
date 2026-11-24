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
  import GroupherServerWeb.Schema.Helper.Mutations

  object :cms_doc_tree_mutations do
    field :restore_docs_snapshot, :docs_begin_edit_result do
      arg(:community, non_null(:string))
      arg(:article_id, non_null(:id))
      arg(:snapshot_id, non_null(:id))
      arg(:working_copy_id, :id)
      arg(:revision, :integer)
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.restore_docs_snapshot/3)
    end

    field :configure_docs_queue, :json do
      arg(:community, non_null(:string))
      arg(:approval_policy_revision, non_null(:integer))
      arg(:approval_required, non_null(:boolean))
      arg(:allow_self_approval, non_null(:boolean))
      arg(:command_id, non_null(:id))
      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.configure_docs_queue/3)
    end

    @desc "Begin editing a public Doc by explicitly creating its default copy when needed"
    field :begin_docs_edit, :docs_begin_edit_result do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:article_id, non_null(:id))
      arg(:public_snapshot_id, non_null(:id))
      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.begin_docs_edit/3)
    end

    @desc "Approve the current complete Docs queue"
    field :approve_docs_queue, :docs_queue_approval_result do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:queue_revision, non_null(:integer))
      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.approve_docs_queue/3)
    end

    @desc "Resolve a Doc's post-publication conflict into its default working copy"
    field :resolve_docs_post_publish, :docs_post_publish_resolution do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:article_id, non_null(:id))
      arg(:working_copy_id, non_null(:id))
      arg(:default_revision, non_null(:integer))
      arg(:public_snapshot_id, non_null(:id))
      arg(:choices, non_null(list_of(non_null(:docs_merge_choice_input))), default_value: [])
      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.resolve_docs_post_publish/3)
    end

    @desc "Save the queued working copy of a Doc"
    field :save_docs_queue_copy, :docs_queue_save_result do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:article_id, non_null(:id))
      arg(:queue_revision, non_null(:integer))
      arg(:working_copy_revision, non_null(:integer))
      arg(:title, :string)
      arg(:digest, :string)
      arg(:slug, :string)
      arg(:body_bag, :artiment_body_bag_input)
      arg(:tag_ids, list_of(:id))
      article_cover_args()
      article_thread_content_args()
      article_asset_args()
      middleware(M.Authorize, :login)
      middleware(M.BodyBagTrust, scope: "content:article:write")
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.save_docs_queue_copy/3)
    end

    @desc "Merge the current default Doc copy into its queued copy"
    field :merge_docs_queue_copy, :docs_queue_merge_result do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:queue_revision, non_null(:integer))
      arg(:article_id, non_null(:id))
      arg(:default_revision, non_null(:integer))
      arg(:working_copy_revision, non_null(:integer))
      arg(:choices, non_null(list_of(non_null(:docs_merge_choice_input))), default_value: [])
      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.merge_docs_queue_copy/3)
    end

    @desc "Permanently remove an unreferenced Docs Trash action"
    field :purge_docs_workspace_trash, :done_state do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:queue_revision, non_null(:integer))
      arg(:trash_action_id, non_null(:id))
      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.purge_docs_workspace_trash/3)
    end

    @desc "Restore a Docs workspace Trash action"
    field :restore_docs_workspace_node, :docs_workspace_restore_result do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:tree_revision, non_null(:integer))
      arg(:queue_revision, non_null(:integer))
      arg(:trash_action_id, non_null(:id))
      arg(:record_revision, non_null(:string))
      arg(:target_parent_node_id, :id)
      arg(:target_index, :integer)
      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.restore_docs_workspace_node/3)
    end

    @desc "Move a Docs workspace subtree to Trash and queue its public deletion"
    field :delete_docs_workspace_node, :docs_workspace_delete_result do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:tree_revision, non_null(:integer))
      arg(:queue_revision, non_null(:integer))
      arg(:node_id, non_null(:id))
      arg(:confirmation, :docs_discard_confirmation_input)
      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.delete_docs_workspace_node/3)
    end

    @desc "Remove Docs from the publication queue"
    field :dequeue_docs, :docs_queue_enqueue_result do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:queue_revision, non_null(:integer))
      arg(:article_ids, non_null(list_of(non_null(:id))))
      arg(:confirmation, :docs_discard_confirmation_input)
      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.dequeue_docs/3)
    end

    @desc "Move a Docs workspace directory node"
    field :move_docs_workspace_node, :docs_workspace_update_result do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:tree_revision, non_null(:integer))
      arg(:node_id, non_null(:id))
      arg(:parent_node_id, :id)
      arg(:position, non_null(:integer))
      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.move_docs_workspace_node/3)
    end

    @desc "Update a Docs workspace directory node"
    field :update_docs_workspace_node, :docs_workspace_update_result do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:tree_revision, non_null(:integer))
      arg(:node_id, non_null(:id))
      arg(:patch, non_null(:docs_workspace_node_patch_input))
      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.update_docs_workspace_node/3)
    end

    @desc "Duplicate a page or link into a new Docs workspace identity"
    field :duplicate_docs_workspace_node, :docs_workspace_node_result do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:tree_revision, non_null(:integer))
      arg(:node_id, non_null(:id))
      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.duplicate_docs_workspace_node/3)
    end

    @desc "Create a Docs workspace directory node"
    field :create_docs_workspace_node, :docs_workspace_node_result do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:tree_revision, non_null(:integer))
      arg(:parent_node_id, :id)
      arg(:input, non_null(:docs_workspace_node_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.create_docs_workspace_node/3)
    end

    @desc "Enqueue Doc working copies and their required navigation nodes"
    field :enqueue_docs, :docs_queue_enqueue_result do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:queue_revision, non_null(:integer))
      arg(:entries, non_null(list_of(non_null(:docs_queue_entry_input))))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.enqueue_docs/3)
    end

    @desc "Publish the complete Docs queue at its expected revision"
    field :release_docs_queue, :docs_queue_release_result do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:queue_revision, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.release_docs_queue/3)
    end

    @desc "add a published Group as a Cover Card"
    field :add_doc_cover_card, :doc_cover_card do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:group_node_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.add_doc_cover_card/3)
    end

    @desc "remove a docs Cover Card"
    field :remove_doc_cover_card, :doc_cover_card do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:group_node_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.remove_doc_cover_card/3)
    end

    @desc "reorder docs Cover Cards"
    field :reorder_doc_cover_cards, :done_state do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:ids, non_null(list_of(non_null(:id))))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.reorder_doc_cover_cards/3)
    end

    @desc "update docs Cover Card appearance"
    field :update_doc_cover_card_appearance, :doc_cover_card do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:appearance, non_null(:json))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.update_doc_cover_card_appearance/3)
    end

    @desc "pin a published docs page to cover"
    field :pin_doc_to_cover, non_null(:doc_cover_pinned_doc) do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:node_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.pin_doc_to_cover/3)
    end

    @desc "remove a published docs page from cover pins"
    field :unpin_doc_from_cover, non_null(:doc_cover_pinned_doc) do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:node_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.unpin_doc_from_cover/3)
    end

    @desc "reorder the complete docs cover pin collection"
    field :reorder_doc_cover_pinned_docs, non_null(:done_state) do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:node_ids, non_null(list_of(non_null(:id))))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.reorder_doc_cover_pinned_docs/3)
    end

    @desc "update a pinned docs cover card appearance"
    field :update_pinned_doc_appearance, non_null(:doc_cover_pinned_doc) do
      arg(:command_id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:node_id, non_null(:id))
      arg(:appearance, non_null(:json))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.PutCurrentUser)
      resolve(&R.CMS.Docs.update_pinned_doc_appearance/3)
    end
  end
end
