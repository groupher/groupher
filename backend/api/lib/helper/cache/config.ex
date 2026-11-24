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

  @doc "Returns a config struct populated from the compile-time `:cache` settings."
  @spec base() :: t()
  def base, do: %__MODULE__{}

  @doc "Returns the configured map of named pool settings, or an empty map when none are configured."
  @spec pool() :: map()
  def pool, do: base().pool
end
