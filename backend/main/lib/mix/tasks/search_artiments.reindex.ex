defmodule Mix.Tasks.SearchArtiments.Reindex do
  @moduledoc "Configures the active search index and rebuilds all Article records."

  use Mix.Task

  alias GroupherServer.CMS.SearchArtiments
  alias GroupherServer.CMS.SearchArtiments.Indexer

  @shortdoc "Rebuild the Search Artiments Article index"

  @impl true
  def run(args) do
    Mix.Task.run("app.start")

    if "--configure" in args do
      platform = SearchArtiments.platform()

      unless function_exported?(platform, :configure_index, 0) do
        Mix.raise("#{inspect(platform)} does not support index configuration")
      end

      :ok = platform.configure_index()
    end

    case Indexer.reindex_articles() do
      :ok -> Mix.shell().info("Search Artiments Article reindex completed")
      {:error, reason} -> Mix.raise("Search Artiments reindex failed: #{inspect(reason)}")
    end
  end
end
