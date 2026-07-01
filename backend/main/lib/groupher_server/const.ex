defmodule GroupherServer.Const do
  @moduledoc """
  Project wrapper around `ex_const`.

  Business modules should `use GroupherServer.Const` instead of depending on
  the third-party `Const` module directly, keeping the public constant API
  owned by Groupher.
  """

  defmacro __using__(_opts) do
    quote do
      use Const
    end
  end
end
