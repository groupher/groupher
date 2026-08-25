defmodule GroupherServer.Jobs.Config do
  @moduledoc """
  Shared Oban job policy for Groupher background jobs.

  Business position:

      Domain event / scheduler
        -> Oban
        -> Config
        -> context / service
  """

  @type job_name :: :later | :search_index | :snapshot_refresh | :view_projection

  @spec queue(job_name()) :: atom()
  def queue(:later), do: :default
  def queue(:search_index), do: :search
  def queue(:snapshot_refresh), do: :snapshot
  def queue(:view_projection), do: :default

  @spec max_attempts(job_name()) :: pos_integer()
  def max_attempts(:later), do: 3
  def max_attempts(:search_index), do: 3
  def max_attempts(:snapshot_refresh), do: 3
  def max_attempts(:view_projection), do: 8

  @spec unique(job_name()) :: keyword()
  def unique(:later), do: []
  def unique(:search_index), do: [period: 60, keys: [:action, :thread, :ref]]
  def unique(:snapshot_refresh), do: [period: 60, keys: [:kind, :refs]]
  def unique(:view_projection), do: [period: 60, keys: [:event_id]]

  @spec skip_enqueue?() :: boolean()
  def skip_enqueue? do
    Application.get_env(:groupher_server, :env) in [:test, :seed_prod]
  end
end
