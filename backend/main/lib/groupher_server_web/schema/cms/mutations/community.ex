defmodule GroupherServerWeb.Schema.CMS.Mutations.Community do
  @moduledoc """
  CMS mations for community
  """
  use Helper.GqlSchemaSuite

  object :cms_mutation_community do
    @desc "create a global community"
    field :create_community, :community do
      arg(:title, non_null(:string))
      arg(:desc, non_null(:string))
      arg(:slug, non_null(:string))
      arg(:logo, non_null(:string))
      arg(:locale, :string)

      middleware(M.Authorize, :login)
      middleware(M.Passport, claim: "cms->community.create")

      resolve(&R.CMS.create_community/3)
      middleware(M.Statistics.MakeContribute, for: [:user])
    end

    @desc "update a community"
    field :update_community, :community do
      arg(:id, non_null(:id))
      arg(:title, :string)
      arg(:desc, :string)
      arg(:slug, :string)
      arg(:logo, :string)
      arg(:locale, :string)

      middleware(M.Authorize, :login)
      middleware(M.Passport, claim: "cms->community.update")

      resolve(&R.CMS.update_community/3)
    end

    @desc "delete a global community"
    field :delete_community, :community do
      arg(:id, non_null(:id))
      middleware(M.Authorize, :login)
      middleware(M.Passport, claim: "cms->community.delete")

      resolve(&R.CMS.delete_community/3)
    end

    @desc "apply to create a community"
    field :apply_community, :community do
      arg(:title, non_null(:string))
      arg(:desc, non_null(:string))
      arg(:slug, non_null(:string))
      arg(:logo, non_null(:string))
      arg(:locale, :string)
      arg(:apply_msg, :string)
      arg(:apply_category, :string)

      middleware(M.Authorize, :login)
      resolve(&R.CMS.apply_community/3)
    end

    @desc "approve the apply to create a community"
    field :approve_community_apply, :community do
      arg(:community, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.Passport, claim: "cms->community.apply.approve")
      resolve(&R.CMS.approve_community_apply/3)
    end

    @desc "deny the apply to create a community"
    field :deny_community_apply, :community do
      arg(:id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.Passport, claim: "cms->community.apply.deny")
      resolve(&R.CMS.deny_community_apply/3)
    end

    @desc "create category"
    field :create_category, :category do
      arg(:title, non_null(:string))
      arg(:slug, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.Passport, claim: "cms->category.create")

      resolve(&R.CMS.create_category/3)
    end

    @desc "delete category"
    field :delete_category, :category do
      arg(:id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.Passport, claim: "cms->category.delete")

      resolve(&R.CMS.delete_category/3)
    end

    @desc "update category"
    field :update_category, :category do
      arg(:id, non_null(:id))
      arg(:title, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.Passport, claim: "cms->category.update")

      resolve(&R.CMS.update_category/3)
    end

    @desc "create independent thread"
    field :create_thread, :thread_item do
      arg(:title, non_null(:string))
      arg(:slug, non_null(:string))
      arg(:index, :integer, default_value: 0)

      middleware(M.Authorize, :login)
      middleware(M.Passport, claim: "cms->thread.create")

      resolve(&R.CMS.create_thread/3)
    end

    @desc "add a moderator for a community"
    field :add_moderator, :community do
      arg(:community, non_null(:string))
      arg(:user, non_null(:string))
      arg(:role, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.PassportLoader, source: :community)
      middleware(M.Passport, claim: "cms->moderator.set")

      resolve(&R.CMS.add_moderator/3)
    end

    # TODO: remove, should remove both moderator and cms->passport
    @desc "unset a moderator from a community, the user's passport also deleted"
    field :remove_moderator, :community do
      arg(:community, non_null(:string))
      arg(:user, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.PassportLoader, source: :community)
      middleware(M.Passport, claim: "cms->moderator.unset")

      resolve(&R.CMS.remove_moderator/3)
    end

    @desc "update cms moderator's title, passport is not effected"
    field :update_moderator_passport, :community do
      arg(:community, non_null(:string))
      arg(:user, non_null(:string))
      arg(:rules, non_null(:json))

      middleware(M.Authorize, :login)
      middleware(M.PassportLoader, source: :community)
      # middleware(M.Passport, claim: "cms->moderator.update")

      resolve(&R.CMS.update_moderator_passport/3)
    end

    @desc "create a tag"
    field :create_article_tag, :article_tag do
      arg(:title, non_null(:string))
      arg(:slug, non_null(:string))
      arg(:color, non_null(:rainbow_color))
      arg(:layout, :string)
      arg(:community, non_null(:string))
      arg(:group, :string)
      arg(:thread, :thread, default_value: :post)
      arg(:extra, list_of(:string))
      arg(:icon, :string)

      middleware(M.Authorize, :login)
      middleware(M.PassportLoader, source: :community)
      middleware(M.Passport, claim: "cms->c?->t?.article_tag.create")

      resolve(&R.CMS.create_article_tag/3)
    end

    @desc "update a tag"
    field :update_article_tag, :article_tag do
      arg(:id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:title, :string)
      arg(:layout, :string)
      arg(:desc, :string)
      arg(:slug, :string)
      arg(:color, :rainbow_color)
      arg(:group, :string)
      arg(:thread, :thread, default_value: :post)
      arg(:extra, list_of(:string))
      arg(:icon, :string)

      middleware(M.Authorize, :login)
      middleware(M.PassportLoader, source: :community)
      # middleware(M.Passport, claim: "cms->c?->t?.article_tag.update")

      resolve(&R.CMS.update_article_tag/3)
    end

    @desc "delete a tag by thread"
    field :delete_article_tag, :article_tag do
      arg(:id, non_null(:id))
      arg(:community, non_null(:string))
      arg(:thread, :thread, default_value: :post)

      middleware(M.Authorize, :login)
      middleware(M.PassportLoader, source: :community)
      middleware(M.Passport, claim: "cms->c?->t?.article_tag.delete")

      resolve(&R.CMS.delete_article_tag/3)
    end
  end
end
