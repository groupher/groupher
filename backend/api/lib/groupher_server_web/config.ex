defmodule GroupherServerWeb.Config do
  @moduledoc """
  Static configuration contract for the GraphQL/web layer.

  Business position:

      HTTP / WebSocket client
        -> Phoenix endpoint
        -> Config
        -> web or domain boundary
  """

  @general_config Application.compile_env(:groupher_server, :general, [])

  @type t :: %__MODULE__{
          page_size: pos_integer(),
          inner_page_size: pos_integer()
        }

  defstruct page_size: Keyword.get(@general_config, :page_size),
            inner_page_size: Keyword.get(@general_config, :inner_page_size)

  @doc "Returns the GraphQL pagination defaults from compile-time application configuration."
  @spec base() :: t()
  def base, do: %__MODULE__{}

  @doc "Returns the configured default number of entries per page."
  @spec page_size() :: pos_integer()
  def page_size, do: base().page_size

  @doc "Returns the configured page size for nested lists."
  @spec inner_page_size() :: pos_integer()
  def inner_page_size, do: base().inner_page_size
end
