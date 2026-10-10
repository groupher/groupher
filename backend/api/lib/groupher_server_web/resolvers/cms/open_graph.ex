defmodule GroupherServerWeb.Resolvers.CMS.OpenGraph do
  @moduledoc """
  Adapts OpenGraph metadata requests to the platform metadata reader.

      GraphQL OpenGraph field -> this resolver -> metadata reader
  """

  alias Helper.OgInfo

  def open_graph_info(_root, %{url: url}, _info) do
    OgInfo.get(url)
  end
end
