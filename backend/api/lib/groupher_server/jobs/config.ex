defmodule GroupherServer.Jobs.Config do
  @moduledoc """
  Shared queue, retry, uniqueness, and enqueue-suppression policy for selected
  Groupher background jobs.

  Business position:

      worker module
          -> Config.queue/1, max_attempts/1, unique/1
          -> Oban worker policy

      Workflow enqueue API
          -> Config.skip_enqueue?/0
          -> skip in test and seed_prod, enqueue in other configured environments
  """

  @type job_name ::
          :later
          | :search_index
          | :snapshot_refresh
          | :article_insights_aggregation
          | :article_insights_retention

  @doc """
  Returns the Oban queue for a known job name.

  ## Examples

      Jobs.Config.queue(:search_index)
  """
  @spec queue(job_name()) :: atom()
  def queue(:later), do: :default
  def queue(:search_index), do: :search
  def queue(:snapshot_refresh), do: :snapshot
  def queue(:article_insights_aggregation), do: :default
  def queue(:article_insights_retention), do: :default

  @doc """
  Returns the retry limit for a known job name.

  ## Examples

      Jobs.Config.max_attempts(:snapshot_refresh)
  """
  @spec max_attempts(job_name()) :: pos_integer()
  def max_attempts(:later), do: 3
  def max_attempts(:search_index), do: 3
  def max_attempts(:snapshot_refresh), do: 3
  def max_attempts(:article_insights_aggregation), do: 3
  def max_attempts(:article_insights_retention), do: 3

  @doc """
  Returns the Oban uniqueness policy for a known job name.

  ## Examples

      Jobs.Config.unique(:search_index)
  """
  @spec unique(job_name()) :: keyword()
  def unique(:later), do: []
  def unique(:search_index), do: [period: 60, keys: [:action, :thread, :ref]]
  def unique(:snapshot_refresh), do: [period: 60, keys: [:type, :refs]]
  def unique(:article_insights_aggregation), do: [period: 30, keys: []]
  def unique(:article_insights_retention), do: [period: 86_400, keys: []]

  @doc """
  Reports whether jobs should be skipped in the current environment.

  ## Examples

      Jobs.Config.skip_enqueue?()
  """
  @spec skip_enqueue?() :: boolean()
  def skip_enqueue? do
    Application.get_env(:groupher_server, :env) in [:test, :seed_prod]
  end
end
