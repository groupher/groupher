defmodule GroupherServerWeb.Schema.Analysis.Types do
  @moduledoc """
  GraphQL types for built-in community Analysis Web.
  """

  use Absinthe.Schema.Notation

  enum :analysis_trend_pages_dimension do
    value(:path)
    value(:entry)
    value(:exit)
    value(:title)
    value(:query)
  end

  enum :analysis_trend_sources_dimension do
    value(:referrer)
    value(:channel)
    value(:domain)
  end

  enum :analysis_trend_environment_dimension do
    value(:browser)
    value(:os)
    value(:device)
    value(:language)
    value(:screen)
  end

  enum :analysis_trend_location_dimension do
    value(:country)
    value(:region)
    value(:city)
  end

  object :analysis_web_range do
    field(:days, :integer)
    field(:start_at, :big_int)
    field(:end_at, :big_int)
    field(:bucket, :string)
  end

  object :analysis_web_metric do
    field(:value, :float)
    field(:previous_value, :float)
    field(:change_rate, :float)
  end

  object :analysis_web_active do
    field(:visitors, non_null(:integer))
  end

  object :analysis_web_overview_summary do
    field(:pageviews, :analysis_web_metric)
    field(:visitors, :analysis_web_metric)
    field(:visits, :analysis_web_metric)
    field(:bounce_rate, :analysis_web_metric)
    field(:visit_duration, :analysis_web_metric)
  end

  object :analysis_web_metric_values do
    field(:visitors, :integer)
    field(:visits, :integer)
    field(:views, :integer)
    field(:bounce_rate, :float)
    field(:visit_duration, :float)
  end

  object :analysis_web_count_metric_values do
    field(:visitors, :integer)
    field(:visits, :integer)
    field(:views, :integer)
  end

  object :analysis_web_dimension_metric_values do
    field(:visitors, :integer)
    field(:visits, :integer)
    field(:views, :integer)
    field(:percentage, :float)
  end

  object :analysis_web_page_dimension_metric do
    field(:value, :string)
    field(:label, :string)
    field(:metrics, :analysis_web_metric_values)
  end

  object :analysis_web_source_dimension_metric do
    field(:value, :string)
    field(:label, :string)
    field(:metrics, :analysis_web_count_metric_values)
  end

  object :analysis_web_dimension_metric do
    field(:value, :string)
    field(:label, :string)
    field(:metrics, :analysis_web_dimension_metric_values)
  end

  object :analysis_web_location_metric do
    field(:value, :string)
    field(:label, :string)
    field(:code, :string)
    field(:metrics, :analysis_web_dimension_metric_values)
  end

  object :analysis_web_error do
    field(:code, :string)
    field(:message, :string)
    field(:section, :string)
    field(:provider_status, :string)
  end

  object :analysis_trend_chart_point do
    field(:timestamp, :big_int)
    field(:views, :integer)
    field(:visits, :integer)
  end

  object :analysis_trend_chart do
    field(:bucket, :string)
    field(:points, list_of(:analysis_trend_chart_point))
  end

  object :analysis_web_traffic_cell do
    field(:weekday, :integer)
    field(:hour, :integer)
    field(:visitors, :integer)
    field(:visits, :integer)
    field(:views, :integer)
  end

  object :analysis_trends_overview do
    field(:status, :string)
    field(:provider, :string)
    field(:range, :analysis_web_range)
    field(:summary, :analysis_web_overview_summary)
    field(:chart, :analysis_trend_chart)
    field(:errors, list_of(:analysis_web_error))
  end

  object :analysis_trend_pages_section do
    field(:status, :string)
    field(:items, list_of(:analysis_web_page_dimension_metric))
    field(:error, :analysis_web_error)
  end

  object :analysis_trend_sources_section do
    field(:status, :string)
    field(:items, list_of(:analysis_web_source_dimension_metric))
    field(:error, :analysis_web_error)
  end

  object :analysis_trend_environment_section do
    field(:status, :string)
    field(:items, list_of(:analysis_web_dimension_metric))
    field(:error, :analysis_web_error)
  end

  object :analysis_trend_location_section do
    field(:status, :string)
    field(:items, list_of(:analysis_web_location_metric))
    field(:error, :analysis_web_error)
  end

  object :analysis_trend_traffic_section do
    field(:status, :string)
    field(:timezone, :string)
    field(:cells, list_of(:analysis_web_traffic_cell))
    field(:error, :analysis_web_error)
  end

  object :analysis_web_count_summary do
    field(:pageviews, :integer)
    field(:visitors, :integer)
    field(:visits, :integer)
    field(:bounces, :integer)
    field(:total_time, :integer)
  end

  object :analysis_web_timeseries_point do
    field(:date, :string)
    field(:pageviews, :integer)
    field(:visits, :integer)
  end

  object :analysis_web_page_metric do
    field(:path, :string)
    field(:title, :string)
    field(:pageviews, :integer)
    field(:visitors, :integer)
    field(:visits, :integer)
    field(:bounces, :integer)
    field(:total_time, :integer)
  end

  object :analysis_web_referrer_metric do
    field(:referrer, :string)
    field(:visitors, :integer)
  end

  object :analysis_web_summary do
    field(:status, :string)
    field(:provider, :string)
    field(:path_scope, :string)
    field(:range, :analysis_web_range)
    field(:summary, :analysis_web_count_summary)
    field(:timeseries, list_of(:analysis_web_timeseries_point))
    field(:top_pages, list_of(:analysis_web_page_metric))
    field(:top_referrers, list_of(:analysis_web_referrer_metric))
    field(:error, :string)
  end
end
