defmodule GroupherServerWeb.Schema.CMS.Mutations.DocTree do
  @moduledoc """
  GraphQL mutations for community docs side-tree editing.
  """
  use Helper.GqlSchemaSuite

  object :cms_doc_tree_mutations do
    @desc "create a docs tree group"
    field :create_doc_tree_group, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:base_revision, :integer)
      arg(:input, non_null(:doc_tree_node_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.create_doc_tree_group/3)
    end

    @desc "create a docs tree page"
    field :create_doc_tree_page, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:base_revision, :integer)
      arg(:input, non_null(:doc_tree_node_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.create_doc_tree_page/3)
    end

    @desc "create a docs tree quick link"
    field :create_doc_tree_link, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:base_revision, :integer)
      arg(:input, non_null(:doc_tree_node_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.create_doc_tree_link/3)
    end

    @desc "update a docs tree node"
    field :update_doc_tree_node, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:base_revision, :integer)
      arg(:patch, non_null(:doc_tree_node_patch_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.update_doc_tree_node/3)
    end

    @desc "update a docs draft document"
    field :update_doc_draft, :doc_draft do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:title, :string)
      arg(:slug, :string)
      arg(:body, :string)

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.update_doc_draft/3)
    end

    @desc "delete a docs tree node"
    field :delete_doc_tree_node, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:base_revision, :integer)

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.delete_doc_tree_node/3)
    end

    @desc "duplicate a docs tree node"
    field :duplicate_doc_tree_node, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:base_revision, :integer)

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.duplicate_doc_tree_node/3)
    end

    @desc "move a docs tree node"
    field :move_doc_tree_node, :doc_tree_mutation_payload do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:base_revision, :integer)
      arg(:target_parent_id, :id)
      arg(:target_index, non_null(:integer))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.move_doc_tree_node/3)
    end
  end
end
