defmodule GroupherServer.CMS.Policy.Config do
  @moduledoc """
  Static configuration contract for CMS policy rules.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Config
        -> Repo / external boundary
  """

  @general_config Application.compile_env(:groupher_server, :general, [])

  @type publish_throttle :: %{
          interval_minutes: pos_integer(),
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

  @spec base() :: t()
  def base, do: %__MODULE__{}

  @spec publish_throttle() :: publish_throttle()
  def publish_throttle, do: base().publish_throttle
end
