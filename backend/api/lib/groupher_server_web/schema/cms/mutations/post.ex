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
    @desc "set cat for a post"
    field :set_post_cat, :post do
      arg(:article, non_null(:article_path_input))
      arg(:cat, non_null(:article_cat_enum))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "post.set_category", thread: :post)
      middleware(M.FrontDesk, {:article, thread: :post})

      resolve(&R.CMS.Articles.set_post_cat/3)
    end

    article_react_mutations(:post, [
      :upvote,
      :pin,
      :emotion,
      :sink,
      :lock_comment
    ])
  end
end
