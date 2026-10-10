defmodule GroupherServer.Jobs.ArticleInsightsRetention do
  @moduledoc """
  Oban worker that applies Article Insights raw and hourly retention.

      Oban cron -> ArticleInsightsRetention -> Analysis.Maintenance
  """

  use Oban.Worker,
    queue: GroupherServer.Jobs.Config.queue(:article_insights_retention),
    max_attempts: GroupherServer.Jobs.Config.max_attempts(:article_insights_retention),
    unique: GroupherServer.Jobs.Config.unique(:article_insights_retention)

  alias GroupherServer.Analysis
  alias Analysis.{Config, Maintenance}

  @impl Oban.Worker
  def perform(%Oban.Job{}) do
    case Maintenance.delete_expired() do
      %{more?: true} -> {:snooze, Config.retention_snooze_seconds()}
      %{more?: false} -> {:ok, :pass}
    end
  end
end
