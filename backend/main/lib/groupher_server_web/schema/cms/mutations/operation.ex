defmodule GroupherServerWeb.Schema.CMS.Mutations.Operation do
  @moduledoc """
  CMS mutations for cms operations
  """
  use Helper.GqlSchemaSuite

  object :cms_operation_mutations do
    @desc "set category to a community"
    field :set_category, :community do
      arg(:community, non_null(:string))
      arg(:category_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "category.set")
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.set_category/3)
    end

    @desc "unset category to a community"
    field :unset_category, :community do
      arg(:community, non_null(:string))
      arg(:category_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "category.unset")
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.unset_category/3)
    end

    @desc "subscribe a community so it can appear in sidebar"
    field :subscribe_community, :community do
      arg(:community, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.subscribe_community/3)
    end

    @desc "unsubscribe a community"
    field :unsubscribe_community, :community do
      arg(:community, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :community)

      resolve(&R.CMS.unsubscribe_community/3)
    end

    @desc "set a community_tag to content"
    field :set_community_tag, :article do
      arg(:article, non_null(:article_ref_input))
      arg(:community_tag_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.ArticleArgs)
      middleware(M.Passport, action: "community_tag.set")
      middleware(M.ArticleLoader)

      resolve(&R.CMS.set_community_tag/3)
    end

    @desc "unset a tag to content"
    field :unset_community_tag, :article do
      arg(:article, non_null(:article_ref_input))
      arg(:community_tag_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.ArticleArgs)
      middleware(M.Passport, action: "community_tag.unset")
      middleware(M.ArticleLoader)

      resolve(&R.CMS.unset_community_tag/3)
    end

    @desc "reindex tags in given group"
    field :reindex_tags_in_group, :done do
      arg(:community, non_null(:string))
      arg(:thread, :thread, default_value: :post)
      arg(:group, non_null(:string))
      arg(:tags, list_of(:reindex_tag_input))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "community_tag.reindex")

      resolve(&R.CMS.reindex_community_tags/3)
    end

    @desc "mirror article to other community"
    field :mirror_article, :article do
      arg(:article, non_null(:article_ref_input))
      arg(:target_community, non_null(:string))
      arg(:community_tags, list_of(:id), default_value: [])

      middleware(M.Authorize, :login)
      middleware(M.ArticleArgs)
      middleware(M.Passport, action: "article.mirror")
      middleware(M.FrontDesk, :target_community)
      middleware(M.ArticleLoader)

      resolve(&R.CMS.mirror_article/3)
    end

    @desc "unmirror article for community"
    field :unmirror_article, :article do
      arg(:article, non_null(:article_ref_input))
      arg(:target_community, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.ArticleArgs)
      middleware(M.Passport, action: "article.unmirror")
      middleware(M.FrontDesk, :target_community)
      middleware(M.ArticleLoader)

      resolve(&R.CMS.unmirror_article/3)
    end

    @desc "move article to other community"
    field :move_article, :article do
      arg(:article, non_null(:article_ref_input))
      arg(:target_community, non_null(:string))
      arg(:community_tags, list_of(:id), default_value: [])

      middleware(M.Authorize, :login)
      middleware(M.ArticleArgs)
      middleware(M.Passport, action: "article.move")
      middleware(M.FrontDesk, :target_community)
      middleware(M.ArticleLoader)

      resolve(&R.CMS.move_article/3)
    end

    @desc "mirror article to home community"
    field :mirror_to_home, :article do
      arg(:article, non_null(:article_ref_input))
      arg(:community_tags, list_of(:id), default_value: [])

      middleware(M.Authorize, :login)
      middleware(M.ArticleArgs)
      middleware(M.Passport, action: "article.mirror_home")
      middleware(M.FrontDesk, target_community: :home)
      middleware(M.ArticleLoader)

      resolve(&R.CMS.mirror_to_home/3)
    end

    @desc "move article to other community"
    field :move_to_blackhole, :article do
      arg(:article, non_null(:article_ref_input))
      arg(:community_tags, list_of(:id), default_value: [])

      middleware(M.Authorize, :login)
      middleware(M.ArticleArgs)
      middleware(M.Passport, action: "article.move_blackhole")
      middleware(M.FrontDesk, target_community: :blackhole)
      middleware(M.ArticleLoader)

      resolve(&R.CMS.move_to_blackhole/3)
    end
  end
end
