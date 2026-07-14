defmodule GroupherServer.CMS.SearchArtiments do
  @moduledoc "Public facade for platform-neutral Artiment search and indexing."

  alias __MODULE__.{Artiment, Query, Result}

  @spec search(map() | Query.t()) :: {:ok, Result.t()} | {:error, term()}
  def search(%Query{} = query), do: platform().search(query)

  def search(attrs) when is_map(attrs) do
    with {:ok, query} <- Query.new(attrs) do
      search(query)
    end
  end

  @spec upsert([Artiment.t()], keyword()) :: :ok | {:error, term()}
  def upsert(artiments, opts \\ []) when is_list(artiments),
    do: platform().upsert(artiments, opts)

  @spec delete([String.t()]) :: :ok | {:error, term()}
  def delete(refs) when is_list(refs), do: platform().delete(refs)

  @spec update_metrics([{String.t(), map()}]) :: :ok | {:error, term()}
  def update_metrics(updates) when is_list(updates), do: platform().update_metrics(updates)

  @spec platform() :: module()
  def platform do
    :groupher_server
    |> Application.fetch_env!(:search_artiments)
    |> Keyword.fetch!(:platform)
  end

  @spec queue() :: module()
  def queue do
    :groupher_server
    |> Application.fetch_env!(:search_artiments)
    |> Keyword.fetch!(:queue)
  end
end
