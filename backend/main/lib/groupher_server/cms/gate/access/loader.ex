defmodule GroupherServer.CMS.Gate.Access.Loader do
  @moduledoc """
  Typed Access Context loader boundary.

  Loader modules locate and lock the authoritative resource facts consumed by
  Access policies. They do not decide actions or construct Decisions.

      Gate.access_check
        -> Access.Loader
        -> typed Access Context
        -> resource Access policy

  Loader functions are internal and must be called by `Access.Check.*`,
  never by Readers, Writers, or GraphQL resolvers.
  """

  alias GroupherServer.CMS.Gate.Access.Loader.{Article, Comment, Community}

  @doc false
  defdelegate community(resource), to: Community, as: :load
  @doc false
  defdelegate article(community, thread, resource), to: Article, as: :load
  @doc false
  defdelegate comment(community, thread, article, resource), to: Comment, as: :load
end
