defmodule GroupherServerWeb.Schema.CMS.Mutations.Blog do
  @moduledoc """
  CMS mutations for blog
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
      arg(:thread, :thread, default_value: :blog)
      arg(:community_tags, list_of(:id))

      middleware(M.Authorize, :login)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.create_article/3)
      middleware(M.Statistics.MakeContribute, for: [:user, :community])
    end

    @desc "update a cms/blog"
    field :update_blog, :blog do
      arg(:article, non_null(:article_ref_input))
      arg(:title, :string)
      arg(:body, :string)
      arg(:digest, :string)
      arg(:copy_right, :string)
      arg(:link_addr, :string)
      arg(:community_tags, list_of(:id))

      middleware(M.Authorize, :login)
      middleware(M.ArticleArgs, thread: :blog)
      middleware(M.Passport, action: "blog.update")
      middleware(M.ArticleLoader)

      resolve(&R.CMS.update_article/3)
    end

    article_react_mutations(:blog, [
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
