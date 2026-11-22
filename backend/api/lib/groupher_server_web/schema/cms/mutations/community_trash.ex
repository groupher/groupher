defmodule GroupherServerWeb.Schema.CMS.Mutations.CommunityTrash do
  @moduledoc """
  GraphQL writes for ordinary Articles hidden in one Community.

      GraphQL -> CommunityTrash resolver -> Receipt command -> Binding Trash
  """
  use Helper.GqlSchemaSuite

  object :cms_community_trash_mutations do
    @desc "Hide one ordinary Article from a Community without deleting the Article"
    field :hide_community_article, non_null(:community_article_binding_trash_item) do
      arg(:community_ref, non_null(:string))
      arg(:thread, non_null(:community_article_trash_thread))
      arg(:article_id, non_null(:id))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.CommunityTrash.hide/3)
    end

    @desc "Restore one Article Binding from its exact Community Trash record"
    field :restore_community_article, non_null(:community_article_binding_trash_item) do
      arg(:community_ref, non_null(:string))
      arg(:thread, non_null(:community_article_trash_thread))
      arg(:article_id, non_null(:id))
      arg(:id, non_null(:id))
      arg(:record_revision, non_null(:string))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.CommunityTrash.restore/3)
    end
  end
end
