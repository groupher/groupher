defmodule GroupherServerWeb.Schema.CMS.Mutations.Doc do
  @moduledoc """
  CMS mutations for doc
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
      arg(:community_id, non_null(:id))
      arg(:thread, :thread, default_value: :doc)
      arg(:article_tags, list_of(:id))

      middleware(M.Authorize, :login)
      # middleware(M.PublishThrottle)
      middleware(M.PublishThrottle, interval: 3, hour_limit: 15, day_limit: 30)
      resolve(&R.CMS.create_article/3)
      middleware(M.Statistics.MakeContribute, for: [:user, :community])
    end

    @desc "update a cms/doc"
    field :update_doc, :doc do
      arg(:id, non_null(:id))
      arg(:title, :string)
      arg(:body, :string)
      arg(:digest, :string)
      arg(:copy_right, :string)
      arg(:link_addr, :string)
      arg(:article_tags, list_of(:id))

      middleware(M.Authorize, :login)
      middleware(M.PassportLoader, source: :doc)
      middleware(M.Passport, claim: "owner;cms->c?->doc.edit")

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
