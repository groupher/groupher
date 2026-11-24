defmodule Mix.Tasks.SearchArtiments.Capacity do
  @moduledoc """
  Prints source record and byte counts for Search Artiments planning.

  Business position:

      operator
        -> mix search_artiments.capacity
        -> app.start
        -> SearchArtiments.Capacity.measure/0
        -> source record / byte counts printed to the terminal
  """

  use Mix.Task

  alias GroupherServer.CMS
  alias CMS.SearchArtiments.Capacity

  @shortdoc "Measure Search Artiments source volume"

  @impl true
  @doc "Starts the application, measures Search Artiments source volume, and prints the result."
  def run(_args) do
    Mix.Task.run("app.start")
    Capacity.measure() |> inspect(pretty: true, limit: :infinity) |> Mix.shell().info()
  end
end
