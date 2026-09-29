defmodule GroupherServer.Analysis.Model.MetricEvent do
  @moduledoc """
  Append-only business metric input owned by Analysis.

      Business owner transaction -> MetricEvent -> Analysis.Aggregator
  """

  use Ecto.Schema

  alias GroupherServer.Analysis
  alias Analysis.Const
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  schema "analysis_metric_events" do
    field(:operation_id, Ecto.UUID)
    field(:community_id, :id)
    field(:article_type, Ecto.Enum, values: GroupherServer.CMS.Artiment.Threads.article_enums())
    field(:article_id, :id)
    field(:metric, Ecto.Enum, values: Const.metrics())
    field(:value, :integer, default: 1)
    field(:actor_type, Ecto.Enum, values: Const.actor_dimensions())
    field(:is_authenticated, :boolean, default: false)
    field(:policy_version, :integer, default: 0)
    field(:occurred_at, :utc_datetime)
    field(:aggregated_at, :utc_datetime)
    field(:attempts, :integer, default: 0)
    field(:last_error, :string)

    timestamps(type: :utc_datetime)
  end
end
