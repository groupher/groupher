defmodule GroupherServerWeb.Schema.CMS.Mutations.Changelog do
  @moduledoc """
  GraphQL mutations for changelog-thread article publishing and editing.

  Business position:

      Client
        -> Absinthe schema / Changelog
        -> resolver or domain context
        -> GraphQL response
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Mutations

  object :cms_changelog_mutations do
    article_react_mutations(:changelog, [
      :upvote,
      :pin,
      :emotion,
      :sink,
      :lock_comment
    ])
  end
end
