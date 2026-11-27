defmodule GroupherServer.CMS.Gate.RateLimit.Publish.Config do
  @moduledoc """
  Static configuration contract for publish throttling.

  Business position:

      GraphQL resolver / job
        -> CMS.Gate.RateLimit.Publish
        -> Config
        -> Workflow
  """

  @general_config Application.compile_env(:groupher_server, :general, [])

  @type publish_throttle :: %{
          interval_minutes: non_neg_integer(),
          hour_limit: pos_integer(),
          day_limit: pos_integer()
        }

  @type t :: %__MODULE__{
          publish_throttle: publish_throttle()
        }

  defstruct publish_throttle: %{
              interval_minutes: Keyword.get(@general_config, :publish_throttle_interval_minutes),
              hour_limit: Keyword.get(@general_config, :publish_throttle_hour_limit),
              day_limit: Keyword.get(@general_config, :publish_throttle_day_limit)
            }

  @doc """
  Returns the default publish throttle configuration struct.

  ## Examples

      Config.base()
      #=> %Config{}
  """
  @spec base() :: t()
  def base, do: %__MODULE__{}

  @doc """
  Returns the configured publish throttle limits.

  ## Examples

      Config.publish_throttle().hour_limit
      #=> 20
  """
  @spec publish_throttle() :: publish_throttle()
  def publish_throttle do
    if Application.get_env(:groupher_server, :env) == :dev do
      case Application.get_env(:groupher_server, :managed_publish_throttle) do
        nil -> base().publish_throttle
        limits -> Map.new(limits)
      end
    else
      base().publish_throttle
    end
  end
end
