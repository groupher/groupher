defmodule GroupherServerWeb.Schema.Analysis.Types do
  @moduledoc """
  GraphQL types for built-in community Web Analysis.
  """

  use Absinthe.Schema.Notation

  object :web_analysis_range do
    field(:days, :integer)
    field(:start_at, :big_int)
    field(:end_at, :big_int)
  end

  object :web_analysis_count_summary do
    field(:pageviews, :integer)
    field(:visitors, :integer)
    field(:visits, :integer)
    field(:bounces, :integer)
    field(:total_time, :integer)
  end

  object :web_analysis_timeseries_point do
    field(:date, :string)
    field(:pageviews, :integer)
    field(:visits, :integer)
  end

  object :web_analysis_page_metric do
    field(:path, :string)
    field(:title, :string)
    field(:pageviews, :integer)
    field(:visitors, :integer)
    field(:visits, :integer)
    field(:bounces, :integer)
    field(:total_time, :integer)
  end

  object :web_analysis_referrer_metric do
    field(:referrer, :string)
    field(:visitors, :integer)
  end

  object :web_analysis_summary do
    field(:status, :string)
    field(:provider, :string)
    field(:path_scope, :string)
    field(:range, :web_analysis_range)
    field(:summary, :web_analysis_count_summary)
    field(:timeseries, list_of(:web_analysis_timeseries_point))
    field(:top_pages, list_of(:web_analysis_page_metric))
    field(:top_referrers, list_of(:web_analysis_referrer_metric))
    field(:error, :string)
  end
end
