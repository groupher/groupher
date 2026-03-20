defmodule Helper.Later do
  @moduledoc """
  background jobs support, currently using https://github.com/samphilipd/rihanna
  """

  @doc """
  ## Example
  iex> Later.run({__MODULE__, :get_contributes_then_cache, [%Community{id: id}]})
  {:ok, _}
  """
  def run({mod, func, args}) do
    if skip_enqueue_env?() do
      _ = {mod, func, args}
      :ok
    else
      Rihanna.enqueue({mod, func, args})
    end

    # whether enqueue success or not, return {:ok, :pass} to avoid Multi.Job rollback.
    {:ok, :pass}
  end

  defp skip_enqueue_env? do
    Application.get_env(:groupher_server, :env) in [:test, :seed_prod]
  end
end
