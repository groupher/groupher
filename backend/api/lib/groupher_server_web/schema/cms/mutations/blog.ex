defmodule GroupherServerWeb.Schema.CMS.Mutations.Blog do
  @moduledoc """
  GraphQL mutations for blog-thread article publishing and editing.

  Business position:

      Client
        -> Absinthe schema / Blog
        -> resolver or domain context
        -> GraphQL response
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Mutations

  object :cms_blog_mutations do
    article_react_mutations(:blog, [
      :upvote,
      :pin,
      :emotion,
      :sink,
      :lock_comment
    ])
  end
end
