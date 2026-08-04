defmodule Helper.Later do
  @moduledoc """
  Background jobs support for fire-and-forget function calls.
  """

  alias GroupherServer.Jobs

  @doc """
  ## Example
  iex> Later.run({__MODULE__, :get_contributes_then_cache, [%Community{id: id}]})
  {:ok, _}
  """
  def run({mod, func, args}) do
    Jobs.later({mod, func, args})
  end
end
