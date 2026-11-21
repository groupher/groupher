defmodule GroupherServer.CMS.SearchArtiments.Projection do
  @moduledoc """
  Stable SearchArtiments entrypoint for rebuilding external search projections.

      SearchArtiments.Indexer
        -> SearchArtiments.Projection
        -> Article projection DTO
  """

  alias __MODULE__.Article

  @doc "Projects one public Article DTO into a Search Artiment."
  defdelegate article(thread, article), to: Article, as: :project
  defdelegate article(thread, article, counts), to: Article, as: :project
end
