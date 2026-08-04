defmodule GroupherServer.Messaging.Config do
  @moduledoc """
  Static configuration contract for messaging.
  """

  @general_config Application.compile_env(:groupher_server, :general, [])

  @type t :: %__MODULE__{
          notify_actions: [atom()],
          notify_group_interval_hour: pos_integer()
        }

  defstruct notify_actions: Keyword.get(@general_config, :nofity_actions, []),
            notify_group_interval_hour: Keyword.get(@general_config, :notify_group_interval_hour)

  @spec base() :: t()
  def base, do: %__MODULE__{}

  @spec notify_actions() :: [atom()]
  def notify_actions, do: base().notify_actions

  @spec notify_group_interval_hour() :: pos_integer()
  def notify_group_interval_hour, do: base().notify_group_interval_hour
end
