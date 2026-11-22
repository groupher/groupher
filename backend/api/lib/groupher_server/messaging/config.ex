defmodule GroupherServer.Messaging.Config do
  @moduledoc """
  Static configuration contract for messaging.

  Business position:

      Domain event
        -> Messaging facade
        -> Config
        -> inbox / notification store
  """

  @general_config Application.compile_env(:groupher_server, :general, [])
  @activity_types GroupherServer.Messaging.NoticeContract.activity_types()

  @type t :: %__MODULE__{
          notify_actions: [atom()],
          notify_group_interval_hour: pos_integer()
        }

  defstruct notify_actions: @activity_types,
            notify_group_interval_hour: Keyword.get(@general_config, :notify_group_interval_hour)

  @doc """
  Returns the static messaging configuration.

  ## Examples

      Messaging.Config.base()
  """
  @spec base() :: t()
  def base, do: %__MODULE__{}

  @doc """
  Returns the notification actions accepted by Messaging.

  ## Examples

      Messaging.Config.notify_actions()
  """
  @spec notify_actions() :: [atom()]
  def notify_actions, do: base().notify_actions

  @doc """
  Returns the notification grouping interval in hours.

  ## Examples

      Messaging.Config.notify_group_interval_hour()
  """
  @spec notify_group_interval_hour() :: pos_integer()
  def notify_group_interval_hour, do: base().notify_group_interval_hour
end
