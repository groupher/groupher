defmodule GroupherServerWeb.Schema.CMS.Mutations.Blog do
  @moduledoc """
  GraphQL mutations for blog-thread article publishing and editing.
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Mutations

  object :cms_blog_mutations do
    @desc "create a blog"
    field :create_blog, :blog do
      arg(:title, non_null(:string))
      arg(:body, non_null(:string))
      arg(:link_addr, :string)
      arg(:copy_right, :string)
      arg(:community, non_null(:string))
      arg(:community_tags, list_of(:id))
      article_cover_args()
      article_asset_args()

      middleware(M.Authorize, :login)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.create_blog/3)
      middleware(M.Statistics.MakeContribute, for: [:user, :community])
    end

    @desc "save a new blog as a draft"
    field :create_blog_draft, :article_draft do
      arg(:title, non_null(:string))
      arg(:body, non_null(:string))
      arg(:link_addr, :string)
      arg(:copy_right, :string)
      arg(:community, non_null(:string))
      arg(:community_tags, list_of(:id))
      article_cover_args()
      article_asset_args()

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.create_blog_draft/3)
    end

    @desc "update a cms/blog"
    field :update_blog, :blog do
      arg(:article, non_null(:article_path_input))
      arg(:title, :string)
      arg(:body, :string)
      arg(:digest, :string)
      arg(:copy_right, :string)
      arg(:link_addr, :string)
      arg(:community_tags, list_of(:id))
      article_cover_args()
      article_asset_args()

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "blog.update", thread: :blog)
      middleware(M.FrontDesk, {:article, thread: :blog})

      resolve(&R.CMS.update_article/3)
    end

    @desc "save changes to a blog draft without publishing"
    field :update_blog_draft, :article_draft do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:title, :string)
      arg(:body, :string)
      arg(:digest, :string)
      arg(:copy_right, :string)
      arg(:link_addr, :string)
      arg(:community_tags, list_of(:id))
      article_cover_args()
      article_asset_args()

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)
      middleware(M.FrontDesk, {:article_editor, thread: :blog})
      middleware(M.Passport, action: "blog.draft.update")
      resolve(&R.CMS.update_blog_draft/3)
    end

    @desc "publish an existing blog draft"
    field :publish_blog_draft, :blog do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)
      middleware(M.FrontDesk, {:article_editor, thread: :blog})
      middleware(M.Passport, action: "blog.draft.publish")
      resolve(&R.CMS.publish_blog_draft/3)
      middleware(M.Statistics.MakeContribute, for: [:user, :community])
    end

    article_react_mutations(:blog, [
      :upvote,
      :pin,
      :emotion,
      :report,
      :sink,
      :lock_comment
    ])
  end
end
