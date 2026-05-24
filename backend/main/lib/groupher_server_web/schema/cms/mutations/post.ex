defmodule GroupherServerWeb.Schema.CMS.Mutations.Post do
  @moduledoc """
  GraphQL mutations for post-thread article publishing and editing.
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Mutations

  object :cms_post_mutations do
    @desc "create a post"
    field :create_post, :post do
      arg(:title, non_null(:string))
      arg(:body, non_null(:string))
      arg(:link_addr, :string)
      arg(:copy_right, :string)
      arg(:community, non_null(:string))
      arg(:thread, :thread, default_value: :post)
      arg(:community_tags, list_of(:id))

      middleware(M.Authorize, :login)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.create_article/3)
      middleware(M.Statistics.MakeContribute, for: [:user, :community])
    end

    @desc "update a cms/post"
    field :update_post, :post do
      arg(:article, non_null(:article_ref_input))
      arg(:title, :string)
      arg(:body, :string)
      arg(:digest, :string)
      arg(:copy_right, :string)
      arg(:link_addr, :string)
      arg(:community_tags, list_of(:id))

      middleware(M.Authorize, :login)
      middleware(M.ArticleArgs, thread: :post)
      middleware(M.Passport, action: "post.update")
      middleware(M.ArticleLoader)

      resolve(&R.CMS.update_article/3)
    end

    @desc "set cat for a post"
    field :set_post_cat, :post do
      arg(:article, non_null(:article_ref_input))
      arg(:cat, non_null(:article_cat_enum))

      middleware(M.Authorize, :login)
      middleware(M.ArticleArgs, thread: :post)
      middleware(M.Passport, action: "post.set_category")
      middleware(M.ArticleLoader)

      resolve(&R.CMS.set_post_cat/3)
    end

    @desc "set status for a post"
    field :set_post_status, :post do
      arg(:article, non_null(:article_ref_input))
      arg(:status, non_null(:article_status_enum))

      middleware(M.Authorize, :login)
      middleware(M.ArticleArgs, thread: :post)
      middleware(M.Passport, action: "post.set_status")
      middleware(M.ArticleLoader)

      resolve(&R.CMS.set_post_status/3)
    end

    article_react_mutations(:post, [
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
