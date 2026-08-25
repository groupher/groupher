defmodule Mix.Tasks.Compile.ErrorCat do
  @moduledoc """
  Validates all ErrorCat catalogs after normal Elixir compilation.

  Normal compilation -> ErrorCat validation -> compiler result.
  """

  use Mix.Task.Compiler

  @impl Mix.Task.Compiler
  def run(_args) do
    GroupherServer.ErrorCat.validate!()
    {:ok, []}
  rescue
    error in [ArgumentError, RuntimeError] ->
      Mix.raise(Exception.message(error))
  end
end
