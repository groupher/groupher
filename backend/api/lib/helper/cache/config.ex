defmodule Helper.Cache.Config do
  @moduledoc """
  Static configuration contract for Cachex pools.

  Business position:

      Domain or web caller
        -> Config
        -> normalized value / infrastructure
  """

  @cache_config Application.compile_env(:groupher_server, :cache, [])

  @type t :: %__MODULE__{
          pool: map()
        }

  defstruct pool: Keyword.get(@cache_config, :pool, %{})

  @spec base() :: t()
  @doc "Runs `base` through the public `Config` boundary."
  def base, do: %__MODULE__{}

  @spec pool() :: map()
  @doc "Runs `pool` through the public `Config` boundary."
  def pool, do: base().pool
end
