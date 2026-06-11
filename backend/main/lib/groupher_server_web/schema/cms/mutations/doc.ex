defmodule GroupherServerWeb.Schema.CMS.Mutations.Doc do
  @moduledoc """
  GraphQL mutations for doc-thread article publishing and editing.
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Mutations

  object :cms_doc_mutations do
    @desc "create a doc"
    field :create_doc, :doc do
      arg(:title, non_null(:string))
      arg(:body, non_null(:string))
      arg(:link_addr, :string)
      arg(:copy_right, :string)
      arg(:community, non_null(:string))
      arg(:thread, :thread, default_value: :doc)
      arg(:community_tags, list_of(:id))
      article_cover_args()

      middleware(M.Authorize, :login)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.create_article/3)
      middleware(M.Statistics.MakeContribute, for: [:user, :community])
    end

    @desc "update a cms/doc"
    field :update_doc, :doc do
      arg(:article, non_null(:article_ref_input))
      arg(:title, :string)
      arg(:body, :string)
      arg(:digest, :string)
      arg(:copy_right, :string)
      arg(:link_addr, :string)
      arg(:community_tags, list_of(:id))
      article_cover_args()

      middleware(M.Authorize, :login)
      middleware(M.ArticleArgs, thread: :doc)
      middleware(M.Passport, action: "doc.update")
      middleware(M.ArticleLoader)

      resolve(&R.CMS.update_article/3)
    end

    article_react_mutations(:doc, [
      :upvote,
      :pin,
      :mark_delete,
      :delete,
      :emotion,
      :report,
      :sink,
      :lock_comment
    ])
  end
end
