defmodule GroupherServer.CMS.SearchArtiments do
  @moduledoc """
  Public facade for platform-neutral Artiment search and indexing.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> SearchArtiments
        -> Repo / external boundary
  """

  alias Helper.T
  alias __MODULE__.{Artiment, Config, Query, Result}

  @doc "Runs `search` through the public `SearchArtiments` boundary."
  @spec search(map() | Query.t()) :: T.domain_res(Result.t())
  def search(%Query{} = query), do: platform().search(query)

  def search(attrs) when is_map(attrs) do
    with {:ok, query} <- Query.new(attrs) do
      search(query)
    end
  end

  @doc "Runs `upsert` through the public `SearchArtiments` boundary."
  @spec upsert([Artiment.t()], keyword()) :: T.done()
  def upsert(artiments, opts \\ []) when is_list(artiments) do
    platform().upsert(artiments, opts)
  end

  @doc "Runs `delete` through the public `SearchArtiments` boundary."
  @spec delete([String.t()]) :: T.done()
  def delete(refs) when is_list(refs), do: platform().delete(refs)

  @doc "Updates metrics through the `SearchArtiments` write boundary."
  @spec update_metrics([{String.t(), map()}]) :: T.done()
  def update_metrics(updates) when is_list(updates), do: platform().update_metrics(updates)

  @doc "Runs `platform` through the public `SearchArtiments` boundary."
  @spec platform() :: module()
  def platform, do: Config.platform()

  @doc "Runs `queue` through the public `SearchArtiments` boundary."
  @spec queue() :: module()
  def queue, do: Config.queue()
end
