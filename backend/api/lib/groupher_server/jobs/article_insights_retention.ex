defmodule GroupherServer.Jobs.ArticleInsightsRetention do
  @moduledoc """
  Oban worker that applies Article Insights raw and hourly retention.

      Oban cron -> ArticleInsightsRetention -> Analysis.Maintenance
  """

  use Oban.Worker,
    queue: GroupherServer.Jobs.Config.queue(:article_insights_retention),
    max_attempts: GroupherServer.Jobs.Config.max_attempts(:article_insights_retention),
    unique: GroupherServer.Jobs.Config.unique(:article_insights_retention)

  alias GroupherServer.Analysis.Maintenance

  @impl Oban.Worker
  def perform(%Oban.Job{}) do
    _ = Maintenance.delete_expired()
    :ok
  end
end
