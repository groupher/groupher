defmodule GroupherServer.CMS.SearchArtiments do
  @moduledoc """
  Public facade for platform-neutral Artiment search and indexing.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> SearchArtiments
        -> Repo / external boundary
  """

  alias __MODULE__.{Artiment, Config, Query, Result}

  @spec search(map() | Query.t()) :: {:ok, Result.t()} | {:error, term()}
  @doc "Runs `search` through the public `SearchArtiments` boundary."
  def search(%Query{} = query), do: platform().search(query)

  def search(attrs) when is_map(attrs) do
    with {:ok, query} <- Query.new(attrs) do
      search(query)
    end
  end

  @spec upsert([Artiment.t()], keyword()) :: :ok | {:error, term()}
  @doc "Runs `upsert` through the public `SearchArtiments` boundary."
  def upsert(artiments, opts \\ []) when is_list(artiments),
    do: platform().upsert(artiments, opts)

  @spec delete([String.t()]) :: :ok | {:error, term()}
  @doc "Runs `delete` through the public `SearchArtiments` boundary."
  def delete(refs) when is_list(refs), do: platform().delete(refs)

  @spec update_metrics([{String.t(), map()}]) :: :ok | {:error, term()}
  @doc "Updates metrics through the `SearchArtiments` write boundary."
  def update_metrics(updates) when is_list(updates), do: platform().update_metrics(updates)

  @spec platform() :: module()
  @doc "Runs `platform` through the public `SearchArtiments` boundary."
  def platform, do: Config.platform()

  @spec queue() :: module()
  @doc "Runs `queue` through the public `SearchArtiments` boundary."
  def queue, do: Config.queue()
end
