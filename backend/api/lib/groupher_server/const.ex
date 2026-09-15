defmodule GroupherServer.Const do
  @moduledoc """
  Adapts the third-party `ex_const` DSL for Groupher-owned enum modules.

  This module does not own application constants. Domain modules such as
  `CMS.Gate.Const` and `CMS.DocTree.Const` own their vocabularies and use this
  adapter instead of depending directly on `Elixir.Const`. That keeps the
  external macro dependency behind a project-owned boundary.

  Business position:

      Domain Const module
        -> use GroupherServer.Const
        -> ex_const DSL
        -> generated enum conversion and values helpers
  """

  @doc """
  Imports the `ex_const` DSL into a Groupher-owned domain constant module.
  """
  defmacro __using__(_opts) do
    quote do
      use Const
    end
  end
end
