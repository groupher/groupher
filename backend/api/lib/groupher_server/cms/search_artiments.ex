defmodule GroupherServer.CMS.SearchArtiments do
  @moduledoc """
  Public facade for platform-neutral Artiment search and indexing.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> SearchArtiments
        -> Repo / external boundary
  """

  alias __MODULE__.{Artiment, Config, Query}
  alias Helper.T

  @doc "Searches with a validated SearchArtiments query using the configured platform adapter."
  @spec search(map(), term()) :: T.domain_res(Helper.ORM.Pagi.Page.t())
  def search(%Query{} = query), do: platform().search(query)

  @doc "Builds a validated search query from raw attributes and canonical pagination input, then executes it."
  def search(attrs, pagi) when is_map(attrs) do
    with {:ok, query} <- Query.new(attrs, pagi) do
      search(query)
    end
  end

  @doc "Upserts canonical Article or Comment search projections through the configured adapter."
  @spec upsert([Artiment.t()], keyword()) :: T.done()
  def upsert(artiments, opts \\ []) when is_list(artiments) do
    platform().upsert(artiments, opts)
  end

  @doc "Deletes search objects by their stable platform references."
  @spec delete([String.t()]) :: T.done()
  def delete(refs) when is_list(refs), do: platform().delete(refs)

  @doc "Partially updates ranking metrics for existing search objects without creating them."
  @spec update_metrics([{String.t(), map()}]) :: T.done()
  def update_metrics(updates) when is_list(updates), do: platform().update_metrics(updates)

  @doc "Runs `platform` through the public `SearchArtiments` boundary."
  @spec platform() :: module()
  def platform, do: Config.platform()

  @doc "Runs `queue` through the public `SearchArtiments` boundary."
  @spec queue() :: module()
  def queue, do: Config.queue()
end
