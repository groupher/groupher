defmodule GroupherServer.CMS.Comments.SchemaGeneration.Startup do
  @moduledoc """
  Refuses production API and worker startup before the shared schema is ready.

      Repo startup -> generation + schema verification -> API / worker admission
  """
  def child_spec(opts), do: %{id: __MODULE__, start: {__MODULE__, :start_link, [opts]}}

  def start_link(_opts) do
    if Application.get_env(:groupher_server, :env) == :prod do
      GroupherServer.CMS.Comments.SchemaGeneration.verify_ready!(GroupherServer.Repo)
    end

    :ignore
  end
end
