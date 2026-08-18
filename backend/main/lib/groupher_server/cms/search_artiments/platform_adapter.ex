defmodule GroupherServer.CMS.SearchArtiments.PlatformAdapter do
  @moduledoc """
  Contract implemented by Search Artiments platforms.

  Business position:

      Resolver / Oban
        -> CMS.SearchArtiments
        -> PlatformAdapter
        -> search platform
  """

  alias GroupherServer.CMS.SearchArtiments.{Artiment, Query, Result}

  @callback upsert([Artiment.t()], keyword()) :: :ok | {:error, term()}
  @callback delete([String.t()]) :: :ok | {:error, term()}
  @callback update_metrics([{String.t(), map()}]) :: :ok | {:error, term()}
  @callback search(Query.t()) :: {:ok, Result.t()} | {:error, term()}
end
