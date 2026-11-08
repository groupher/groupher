defmodule GroupherServerWeb.Resolvers.CMS.ArtimentStatus do
  @moduledoc """
  Reads resource status through the CMS FrontDesk boundary.

      GraphQL artimentStatus -> CMS.FrontDesk -> Artiment.Status
  """

  alias GroupherServer.CMS

  def read(_root, %{community: community, locator: locator}, _info) do
    CMS.artiment_status(community, locator)
  end
end
