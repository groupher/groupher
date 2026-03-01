defmodule GroupherServerWeb.Schema.CMS.Mutations.Changelog do
  @moduledoc """
  CMS mutations for changelog
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Mutations

  object :cms_changelog_mutations do
    @desc "create a changelog"
    field :create_changelog, :changelog do
      arg(:title, non_null(:string))
      arg(:body, non_null(:string))
      arg(:link_addr, :string)
      arg(:copy_right, :string)
      arg(:community, non_null(:string))
      arg(:thread, :thread, default_value: :changelog)
      arg(:community_tags, list_of(:id))

      middleware(M.Authorize, :login)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)
      resolve(&R.CMS.create_article/3)
      middleware(M.Statistics.MakeContribute, for: [:user, :community])
    end

    @desc "update a cms/changelog"
    field :update_changelog, :changelog do
      arg(:article, non_null(:article_ref_input))
      arg(:title, :string)
      arg(:body, :string)
      arg(:digest, :string)
      arg(:copy_right, :string)
      arg(:link_addr, :string)
      arg(:community_tags, list_of(:id))

      middleware(M.Authorize, :login)
      middleware(M.ArticleArgs, thread: :changelog)
      middleware(M.Passport, claim: "owner;cms->c?->changelog.edit")
      middleware(M.ArticleLoader)

      resolve(&R.CMS.update_article/3)
    end

    article_react_mutations(:changelog, [
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
