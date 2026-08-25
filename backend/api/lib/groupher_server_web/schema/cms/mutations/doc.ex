defmodule GroupherServerWeb.Schema.CMS.Mutations.Doc do
  @moduledoc """
  GraphQL mutations for doc-thread article publishing and editing.

  Business position:

      Client
        -> Absinthe schema / Doc
        -> resolver or domain context
        -> GraphQL response
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Mutations

  object :cms_doc_mutations do
    article_react_mutations(:doc, [
      :upvote,
      :pin,
      :emotion,
      :report,
      :sink,
      :lock_comment
    ])
  end
end
