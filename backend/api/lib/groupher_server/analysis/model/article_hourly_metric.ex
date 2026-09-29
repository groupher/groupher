defmodule GroupherServer.Analysis.Model.ArticleHourlyMetric do
  @moduledoc """
  Materialized Article metric values grouped into UTC hour buckets.

      Aggregator -> ArticleHourlyMetric -> ArticleInsights query
  """

  use Ecto.Schema

  alias GroupherServer.Analysis
  alias Analysis.Const
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  schema "article_hourly_metrics" do
    field(:community_id, :id)
    field(:article_type, Ecto.Enum, values: GroupherServer.CMS.Artiment.Threads.article_enums())
    field(:article_id, :id)
    field(:bucket_started_at, :utc_datetime)
    field(:metric, Ecto.Enum, values: Const.metrics())
    field(:actor_type, Ecto.Enum, values: Const.actor_dimensions())
    field(:is_authenticated, :boolean, default: false)
    field(:policy_version, :integer, default: 0)
    field(:value, :integer, default: 0)

    timestamps(type: :utc_datetime)
  end
end
