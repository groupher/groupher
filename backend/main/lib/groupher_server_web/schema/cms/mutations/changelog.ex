defmodule GroupherServerWeb.Schema.CMS.Mutations.Changelog do
  @moduledoc """
  GraphQL mutations for changelog-thread article publishing and editing.
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Mutations

  object :cms_changelog_mutations do
    @desc "create a changelog"
    field :create_changelog, :changelog do
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
      resolve(&R.CMS.create_changelog/3)
      middleware(M.Analysis.MakeContribution, for: [:user, :community])
    end

    @desc "save a new changelog as a draft"
    field :create_changelog_draft, :article_draft do
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
      resolve(&R.CMS.create_changelog_draft/3)
    end

    @desc "update a cms/changelog"
    field :update_changelog, :changelog do
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
      middleware(M.Passport, action: "changelog.update", thread: :changelog)
      middleware(M.FrontDesk, {:article, thread: :changelog})

      resolve(&R.CMS.update_article/3)
    end

    @desc "save changes to a changelog draft without publishing"
    field :update_changelog_draft, :article_draft do
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
      middleware(M.FrontDesk, {:article_editor, thread: :changelog})
      middleware(M.Passport, action: "changelog.draft.update")
      resolve(&R.CMS.update_changelog_draft/3)
    end

    @desc "publish an existing changelog draft"
    field :publish_changelog_draft, :changelog do
      arg(:community, non_null(:string))
      arg(:id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      middleware(M.FrontDesk, :community)
      middleware(M.FrontDesk, {:article_editor, thread: :changelog})
      middleware(M.Passport, action: "changelog.draft.publish")
      resolve(&R.CMS.publish_changelog_draft/3)
      middleware(M.Analysis.MakeContribution, for: [:user, :community])
    end

    article_react_mutations(:changelog, [
      :upvote,
      :pin,
      :emotion,
      :report,
      :sink,
      :lock_comment
    ])
  end
end
