defmodule Mix.Tasks.SearchArtiments.Capacity do
  @moduledoc """
  Prints source record and byte counts for Search Artiments planning.

  Business position:

      Operator
        -> Mix task / Capacity
        -> context / service
        -> terminal output
  """

  use Mix.Task

  alias GroupherServer.CMS.SearchArtiments.Capacity

  @shortdoc "Measure Search Artiments source volume"

  @impl true
  def run(_args) do
    Mix.Task.run("app.start")
    Capacity.measure() |> inspect(pretty: true, limit: :infinity) |> Mix.shell().info()
  end
end
