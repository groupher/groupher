defmodule GroupherServer.Jobs.Config do
  @moduledoc """
  Shared Oban job policy for Groupher background jobs.

  Business position:

      Domain event / scheduler
        -> Oban
        -> Config
        -> context / service
  """

  @type job_name ::
          :later
          | :search_index
          | :snapshot_refresh
          | :view_projection
          | :article_insights_aggregation
          | :article_insights_retention

  @spec queue(job_name()) :: atom()
  def queue(:later), do: :default
  def queue(:search_index), do: :search
  def queue(:snapshot_refresh), do: :snapshot
  def queue(:view_projection), do: :default
  def queue(:article_insights_aggregation), do: :default
  def queue(:article_insights_retention), do: :default

  @spec max_attempts(job_name()) :: pos_integer()
  def max_attempts(:later), do: 3
  def max_attempts(:search_index), do: 3
  def max_attempts(:snapshot_refresh), do: 3
  def max_attempts(:view_projection), do: 8
  def max_attempts(:article_insights_aggregation), do: 3
  def max_attempts(:article_insights_retention), do: 3

  @spec unique(job_name()) :: keyword()
  def unique(:later), do: []
  def unique(:search_index), do: [period: 60, keys: [:action, :thread, :ref]]
  def unique(:snapshot_refresh), do: [period: 60, keys: [:kind, :refs]]
  # Generation is part of the identity: a replay must not be deduplicated by
  # an old discarded Job retained for the same event id.
  def unique(:view_projection), do: [period: 60, keys: [:event_id, :projection_generation]]
  def unique(:article_insights_aggregation), do: [period: 30, keys: []]
  def unique(:article_insights_retention), do: [period: 86_400, keys: []]

  @spec skip_enqueue?() :: boolean()
  def skip_enqueue? do
    Application.get_env(:groupher_server, :env) in [:test, :seed_prod]
  end
end
