defmodule GroupherServer.CMS.DocTree do
  @moduledoc """
  Public navigation facade for the branch-free Docs site.

      public reader -> DocTree.Query -> current published navigation and ArticlePublic

  Workspace and publication commands have explicit Gate and Receipt boundaries.
  """
  @doc "Reads the currently visible published site navigation."
  defdelegate read_public(community), to: GroupherServer.CMS.DocTree.Query
end
