defmodule GroupherServerWeb.Schema.CMS.Mutations.Post do
  @moduledoc """
  GraphQL mutations for post-thread article publishing and editing.

  Business position:

      Client
        -> Absinthe schema / Post
        -> resolver or domain context
        -> GraphQL response
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Mutations

  object :cms_post_mutations do
    @desc "create a post"
    field :create_post, :post do
      arg(:title, non_null(:string))
      arg(:body_bag, non_null(:artiment_body_bag_input))
      arg(:link_addr, :string)
      arg(:copy_right, :string)
      arg(:community, non_null(:string))
      arg(:community_tags, list_of(:id))
      article_cover_args()
      article_asset_args()

      middleware(M.Authorize, :login)
      middleware(M.BodyBagTrust)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.create_post/3)
      middleware(M.Analysis.MakeContribution, for: [:user, :community])
    end

    @desc "save a new post as a draft"
    field :create_post_draft, :article_draft do
      arg(:title, non_null(:string))
      arg(:body_bag, non_null(:artiment_body_bag_input))
      arg(:link_addr, :string)
      arg(:copy_right, :string)
      arg(:community, non_null(:string))
      arg(:community_tags, list_of(:id))
      article_cover_args()
      article_asset_args()

      middleware(M.Authorize, :login)
      middleware(M.BodyBagTrust)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.create_post_draft/3)
    end

    @desc "update a cms/post"
    field :update_post, :post do
      arg(:article, non_null(:article_path_input))
      arg(:title, :string)
      arg(:body_bag, :artiment_body_bag_input)
      arg(:digest, :string)
      arg(:copy_right, :string)
      arg(:link_addr, :string)
      arg(:community_tags, list_of(:id))
      article_cover_args()
      article_asset_args()

      middleware(M.Authorize, :login)
      middleware(M.BodyBagTrust)
      middleware(M.Passport, action: "post.update", thread: :post)
      middleware(M.FrontDesk, {:article, thread: :post})

      resolve(&R.CMS.update_article/3)
    end

    @desc "save changes to a post draft without publishing"
    field :update_post_draft, :article_draft do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))
      arg(:title, :string)
      arg(:body_bag, :artiment_body_bag_input)
      arg(:digest, :string)
      arg(:copy_right, :string)
      arg(:link_addr, :string)
      arg(:community_tags, list_of(:id))
      article_cover_args()
      article_asset_args()

      middleware(M.Authorize, :login)
      middleware(M.BodyBagTrust)
      middleware(M.FrontDesk, :community)
      middleware(M.FrontDesk, {:article_editor, thread: :post})
      middleware(M.Passport, action: "post.draft.update")
      resolve(&R.CMS.update_post_draft/3)
    end

    @desc "publish an existing post draft"
    field :publish_post_draft, :post do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)
      middleware(M.FrontDesk, {:article_editor, thread: :post})
      middleware(M.Passport, action: "post.draft.publish")
      resolve(&R.CMS.publish_post_draft/3)
      middleware(M.Analysis.MakeContribution, for: [:user, :community])
    end

    @desc "set cat for a post"
    field :set_post_cat, :post do
      arg(:article, non_null(:article_path_input))
      arg(:cat, non_null(:article_cat_enum))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "post.set_category", thread: :post)
      middleware(M.FrontDesk, {:article, thread: :post})

      resolve(&R.CMS.set_post_cat/3)
    end

    @desc "set status for a post"
    field :set_post_status, :post do
      arg(:article, non_null(:article_path_input))
      arg(:status, non_null(:article_status_enum))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "post.set_status", thread: :post)
      middleware(M.FrontDesk, {:article, thread: :post})

      resolve(&R.CMS.set_post_status/3)
    end

    article_react_mutations(:post, [
      :upvote,
      :pin,
      :emotion,
      :report,
      :sink,
      :lock_comment
    ])
  end
end
