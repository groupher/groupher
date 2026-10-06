defmodule GroupherServer.CMS.SearchArtiments.PlatformAdapter do
  @moduledoc """
  Contract implemented by Search Artiments platforms.

  Business position:

      Resolver / Oban
        -> CMS.SearchArtiments
        -> PlatformAdapter
        -> search platform
  """

  alias GroupherServer.CMS
  alias Helper.T

  alias CMS.SearchArtiments.{Artiment, Query, Result}

  @callback upsert([Artiment.t()], keyword()) :: T.done()
  @callback delete([String.t()]) :: T.done()
  @callback update_metrics([{String.t(), map()}]) :: T.done()
  @callback search(Query.t()) :: T.domain_res(Result.t())
end
