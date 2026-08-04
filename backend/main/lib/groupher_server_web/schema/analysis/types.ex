defmodule GroupherServerWeb.Schema.Analysis.Types do
  @moduledoc """
  GraphQL types for built-in community Analysis Web.
  """

  use Absinthe.Schema.Notation

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

  object :analysis_web_count_dimension_metric do
    field(:value, :string)
    field(:label, :string)
    field(:metrics, :analysis_web_count_metric_values)
  end

  object :analysis_web_pages_section do
    field(:status, :string)
    field(:path, list_of(:analysis_web_page_dimension_metric))
    field(:url, list_of(:analysis_web_page_dimension_metric))
    field(:entry, list_of(:analysis_web_count_dimension_metric))
    field(:exit, list_of(:analysis_web_count_dimension_metric))
    field(:title, list_of(:analysis_web_page_dimension_metric))
    field(:query, list_of(:analysis_web_count_dimension_metric))
  end

  object :analysis_web_source_dimension_metric do
    field(:value, :string)
    field(:label, :string)
    field(:metrics, :analysis_web_count_metric_values)
  end

  object :analysis_web_sources_section do
    field(:status, :string)
    field(:referrer, list_of(:analysis_web_source_dimension_metric))
    field(:channel, list_of(:analysis_web_source_dimension_metric))
    field(:domain, list_of(:analysis_web_source_dimension_metric))
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

  object :analysis_web_environment_section do
    field(:status, :string)
    field(:browser, list_of(:analysis_web_dimension_metric))
    field(:os, list_of(:analysis_web_dimension_metric))
    field(:device, list_of(:analysis_web_dimension_metric))
    field(:language, list_of(:analysis_web_dimension_metric))
    field(:screen, list_of(:analysis_web_dimension_metric))
  end

  object :analysis_web_location_section do
    field(:status, :string)
    field(:country, list_of(:analysis_web_location_metric))
    field(:region, list_of(:analysis_web_location_metric))
    field(:city, list_of(:analysis_web_location_metric))
  end

  object :analysis_web_traffic_cell do
    field(:weekday, :integer)
    field(:hour, :integer)
    field(:visitors, :integer)
    field(:visits, :integer)
    field(:views, :integer)
  end

  object :analysis_web_traffic_section do
    field(:status, :string)
    field(:timezone, :string)
    field(:cells, list_of(:analysis_web_traffic_cell))
  end

  object :analysis_web_timeseries_v2_point do
    field(:bucket, :string)
    field(:timestamp, :big_int)
    field(:visitors, :integer)
    field(:visits, :integer)
    field(:views, :integer)
  end

  object :analysis_web_timeseries_section do
    field(:status, :string)
    field(:bucket, :string)
    field(:points, list_of(:analysis_web_timeseries_v2_point))
  end

  object :analysis_web_error do
    field(:code, :string)
    field(:message, :string)
    field(:section, :string)
    field(:provider_status, :string)
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

  object :analysis_web_overview do
    field(:status, :string)
    field(:provider, :string)
    field(:path_scope, :string)
    field(:range, :analysis_web_range)
    field(:filters, :string)
    field(:summary, :analysis_web_overview_summary)
    field(:timeseries, :analysis_web_timeseries_section)
    field(:pages, :analysis_web_pages_section)
    field(:sources, :analysis_web_sources_section)
    field(:environment, :analysis_web_environment_section)
    field(:location, :analysis_web_location_section)
    field(:traffic, :analysis_web_traffic_section)
    field(:errors, list_of(:analysis_web_error))
  end
end
