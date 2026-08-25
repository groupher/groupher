defmodule GroupherServer.CMS.Interactions.Config do
  @moduledoc """
  Runtime policy values for reaction projections.

  Business position:

      CMS.Interactions worker
        -> Interactions.Config
        -> application runtime configuration
  """

  alias GroupherServer.CMS.Artiment.Config, as: ArtimentConfig

  @doc "Returns Article threads recognized by Interaction projections."
  @spec article_threads() :: [atom()]
  def article_threads, do: ArtimentConfig.threads()

  @doc "Returns Article emotion types recognized by Interaction projections."
  @spec emotions() :: [atom()]
  def emotions, do: ArtimentConfig.emotions()

  @doc "Returns Comment emotion types recognized by Interaction projections."
  @spec comment_emotions() :: [atom()]
  def comment_emotions, do: ArtimentConfig.comment_emotions()

  @doc """
  Returns the maximum number of durable view events projected per job.

  ## Examples

      Config.view_batch_size()

  """
  @spec view_batch_size() :: pos_integer()
  def view_batch_size do
    runtime()
    |> Keyword.get(:view_batch_size, 100)
  end

  @doc """
  Returns how long processed view events remain before retention cleanup.

  ## Examples

      Config.view_event_retention_days()

  """
  @spec view_event_retention_days() :: pos_integer()
  def view_event_retention_days do
    runtime()
    |> Keyword.get(:view_event_retention_days, 30)
  end

  @doc """
  Returns the maximum number of user snapshots retained on a projection row.

  ## Examples

      Config.latest_users_limit()

  """
  @spec latest_users_limit() :: pos_integer()
  def latest_users_limit do
    runtime()
    |> Keyword.get(:latest_users_limit, 5)
  end

  defp runtime do
    Application.get_env(:groupher_server, __MODULE__, [])
  end
end
