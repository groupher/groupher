defmodule Helper.Cache.Config do
  @moduledoc """
  Static configuration contract for Cachex pools.
  """

  @cache_config Application.compile_env(:groupher_server, :cache, [])

  @type t :: %__MODULE__{
          pool: map()
        }

  defstruct pool: Keyword.get(@cache_config, :pool, %{})

  @spec base() :: t()
  def base, do: %__MODULE__{}

  @spec pool() :: map()
  def pool, do: base().pool
end
