defmodule GroupherServerWeb.Schema.Analysis.Spec do
  @moduledoc """
  GraphQL types for built-in community Analysis Web.

  Business position:

      Client
        -> Absinthe schema / Types
        -> resolver or domain context
        -> GraphQL response
  """

  use Absinthe.Schema.Notation

  enum :article_insights_metric do
    @desc "Counted article views after the view policy and deduplication checks."
    value(:article_view)
    @desc "Upvotes added to the article during the bucket."
    value(:upvote_added)
    @desc "Upvotes removed from the article during the bucket."
    value(:upvote_removed)
    @desc "Times the article was added to a collection."
    value(:collect_added)
    @desc "Times the article was removed from a collection."
    value(:collect_removed)
    @desc "Emotion reactions added to the article."
    value(:emotion_added)
    @desc "Emotion reactions removed from the article."
    value(:emotion_removed)
    @desc "Comments created on the article."
    value(:comment_created)
    @desc "Comments deleted from the article."
    value(:comment_deleted)
  end

  enum :article_insights_actor_type do
    @desc "Selects article views attributed to human readers, signed in or not."
    value(:human)
    @desc "Selects article views attributed to automated agents."
    value(:agent)

    @desc "Selects article views classified as crawler traffic; the current view policy excludes them."
    value(:crawler)

    @desc "Selects article views with an unclassified actor; the current view policy excludes them."
    value(:unknown)
  end

  object :article_insights_bucket do
    @desc "Start of the UTC hour covered by this bucket."
    field(:bucket_started_at, non_null(:datetime))

    @desc "Counts keyed by requested metric. Each entry has a value and policy_versions; missing data yields zero and an empty list."
    field(:metrics, non_null(:json))
  end

  object :article_insights_trend do
    @desc "Bucket size, currently hour."
    field(:interval, non_null(:string))
    @desc "Inclusive start of the first UTC hour in the result."
    field(:from, non_null(:datetime))
    @desc "Exclusive UTC hour boundary after the last bucket."
    field(:to, non_null(:datetime))
    @desc "Hourly buckets in chronological order, including hours with no matching events."
    field(:items, non_null(list_of(non_null(:article_insights_bucket))))
    @desc "Distinct policy versions from matching metric rows, sorted in ascending order."
    field(:policy_versions, non_null(list_of(non_null(:integer))))
    @desc "True when matching metric rows span more than one policy version."
    field(:has_mixed_policy, non_null(:boolean))
  end

  enum :analysis_trend_pages_dimension do
    @desc "Group by the URL path of the viewed page."
    value(:path)
    @desc "Group by the first page of a visit."
    value(:entry)
    @desc "Group by the last page of a visit."
    value(:exit)
    @desc "Group by the recorded page title."
    value(:title)
    @desc "Group by the URL query string."
    value(:query)
  end

  enum :analysis_trend_sources_dimension do
    @desc "Group by referrer; traffic without a referrer appears as Direct."
    value(:referrer)
    @desc "Group by acquisition channel."
    value(:channel)
    @desc "Group by the provider's domain dimension."
    value(:domain)
  end

  enum :analysis_trend_environment_dimension do
    @desc "Group by the visitor's browser."
    value(:browser)
    @desc "Group by the visitor's operating system."
    value(:os)
    @desc "Group by device type."
    value(:device)
    @desc "Group by the visitor's browser language."
    value(:language)
    @desc "Group by screen resolution."
    value(:screen)
  end

  enum :analysis_trend_location_dimension do
    @desc "Group by visitor country."
    value(:country)
    @desc "Group by region within a country."
    value(:region)
    @desc "Group by visitor city."
    value(:city)
  end

  object :analysis_web_range do
    @desc "Length of the rolling reporting window in 24-hour days."
    field(:days, :integer)
    @desc "Start of the reporting window in Unix milliseconds, serialized as a string."
    field(:start_at, :big_int)
    @desc "End of the reporting window in Unix milliseconds, serialized as a string."
    field(:end_at, :big_int)
    @desc "Chart interval: hour for windows of up to two days, otherwise day."
    field(:bucket, :string)
  end

  object :analysis_web_metric do
    @desc "Metric for the current window, in the units of the selected summary field."
    field(:value, :float)
    @desc "Provider comparison value in the same units as the current value."
    field(:previous_value, :float)

    @desc "Relative change from the previous value, in percent (10 means a 10% increase); null when the previous value is zero."
    field(:change_rate, :float)
  end

  object :analysis_web_active do
    @desc "Visitors currently active on this community's tracked website; the count is cached for 30 seconds."
    field(:visitors, non_null(:integer))
  end

  object :analysis_web_overview_summary do
    @desc "Number of page views, including repeat views."
    field(:pageviews, :analysis_web_metric)
    @desc "Visitor count reported for the website."
    field(:visitors, :analysis_web_metric)
    @desc "Number of visits (sessions) to the website."
    field(:visits, :analysis_web_metric)
    @desc "Bounces divided by visits, as a fraction from 0 to 1; zero when there are no visits."
    field(:bounce_rate, :analysis_web_metric)

    @desc "Average seconds per visit (total visit time divided by visits); zero when there are no visits."
    field(:visit_duration, :analysis_web_metric)
  end

  object :analysis_web_metric_values do
    @desc "Visitor count for this page dimension value."
    field(:visitors, :integer)
    @desc "Visit count for this page dimension value."
    field(:visits, :integer)
    @desc "Page views for this page dimension value."
    field(:views, :integer)

    @desc "Bounces divided by visits (0 to 1) for path and title rows; null for other page dimensions."
    field(:bounce_rate, :float)
    @desc "Average seconds per visit for path and title rows; null for other page dimensions."
    field(:visit_duration, :float)
  end

  object :analysis_web_count_metric_values do
    @desc "Visitors attributed to this traffic source."
    field(:visitors, :integer)
    @desc "Visits attributed to this traffic source."
    field(:visits, :integer)
    @desc "Page views attributed to this traffic source."
    field(:views, :integer)
  end

  object :analysis_web_dimension_metric_values do
    @desc "Visitors in this dimension row."
    field(:visitors, :integer)
    @desc "Visits in this dimension row."
    field(:visits, :integer)
    @desc "Page views in this dimension row."
    field(:views, :integer)

    @desc "Row visitors divided by the sum of visitors across provider rows, as a fraction from 0 to 1."
    field(:percentage, :float)
  end

  object :analysis_web_page_dimension_metric do
    @desc "Provider value for the selected page dimension, such as a path or page title."
    field(:value, :string)
    @desc "Display text for this page dimension value."
    field(:label, :string)
    @desc "Traffic counts and available engagement metrics for this page group."
    field(:metrics, :analysis_web_metric_values)
  end

  object :analysis_web_source_dimension_metric do
    @desc "Traffic source key; direct denotes traffic with no referrer in the referrer breakdown."
    field(:value, :string)
    @desc "Display text for the source, including Direct for a missing referrer."
    field(:label, :string)
    @desc "Visitor, visit and page view counts for this source."
    field(:metrics, :analysis_web_count_metric_values)
  end

  object :analysis_web_dimension_metric do
    @desc "Provider value for the selected environment dimension, such as a browser name."
    field(:value, :string)
    @desc "Display text for this environment group."
    field(:label, :string)
    @desc "Traffic counts and share of visitors for this environment group."
    field(:metrics, :analysis_web_dimension_metric_values)
  end

  object :analysis_web_location_metric do
    @desc "Provider value for the selected country, region or city."
    field(:value, :string)
    @desc "Display text for this location group."
    field(:label, :string)
    @desc "Country code for country rows; null for region and city rows."
    field(:code, :string)
    @desc "Traffic counts and share of visitors for this location group."
    field(:metrics, :analysis_web_dimension_metric_values)
  end

  object :analysis_web_error do
    @desc "Machine-readable reason for the analytics failure, such as provider_timeout."
    field(:code, :string)
    @desc "Explanation of the analytics failure."
    field(:message, :string)
    @desc "Name of the affected part of the report, such as summary or chart."
    field(:section, :string)
    @desc "Provider HTTP status as a string when available; otherwise null."
    field(:provider_status, :string)
  end

  object :analysis_trend_chart_point do
    @desc "Start of the UTC chart bucket in Unix milliseconds, serialized as a string."
    field(:timestamp, :big_int)
    @desc "Page views in this chart bucket."
    field(:views, :integer)
    @desc "Visits in this chart bucket."
    field(:visits, :integer)
  end

  object :analysis_trend_chart do
    @desc "UTC interval shared by the chart points: hour or day."
    field(:bucket, :string)
    @desc "Reported buckets in chronological order; empty when chart data is unavailable."
    field(:points, list_of(:analysis_trend_chart_point))
  end

  object :analysis_web_traffic_cell do
    @desc "UTC weekday index, from 0 (Sunday) to 6 (Saturday)."
    field(:weekday, :integer)
    @desc "UTC hour of day, from 0 to 23."
    field(:hour, :integer)
    @desc "Visitors for this weekday and hour across the reporting window."
    field(:visitors, :integer)

    @desc "Visits for this weekday and hour; equals visitors when the provider supplies only one count."
    field(:visits, :integer)

    @desc "Page views for this weekday and hour; zero when the provider supplies only a session count."
    field(:views, :integer)
  end

  object :analysis_trends_overview do
    @desc "Availability of the summary and chart: ok, partial or unavailable."
    field(:status, :string)
    @desc "Analytics provider identifier, currently umami."
    field(:provider, :string)
    @desc "Reporting window used for both the summary and the chart."
    field(:range, :analysis_web_range)

    @desc "Current and comparison metrics; counts default to zero when the summary is unavailable."
    field(:summary, :analysis_web_overview_summary)
    @desc "Page views and visits grouped by hour or day."
    field(:chart, :analysis_trend_chart)
    @desc "Failures affecting the overview or its sections; empty when both sections succeeded."
    field(:errors, list_of(:analysis_web_error))
  end

  object :analysis_trend_pages_section do
    @desc "Availability of the page breakdown: ok or unavailable."
    field(:status, :string)
    @desc "Rows for the selected page dimension; empty when unavailable."
    field(:items, list_of(:analysis_web_page_dimension_metric))
    @desc "Reason the page breakdown is unavailable; null on success."
    field(:error, :analysis_web_error)
  end

  object :analysis_trend_sources_section do
    @desc "Availability of the traffic source breakdown: ok or unavailable."
    field(:status, :string)
    @desc "Rows for the selected source dimension; empty when unavailable."
    field(:items, list_of(:analysis_web_source_dimension_metric))
    @desc "Reason the source breakdown is unavailable; null on success."
    field(:error, :analysis_web_error)
  end

  object :analysis_trend_environment_section do
    @desc "Availability of the visitor environment breakdown: ok or unavailable."
    field(:status, :string)
    @desc "Rows for the selected environment dimension; empty when unavailable."
    field(:items, list_of(:analysis_web_dimension_metric))
    @desc "Reason the environment breakdown is unavailable; null on success."
    field(:error, :analysis_web_error)
  end

  object :analysis_trend_location_section do
    @desc "Availability of the location breakdown: ok or unavailable."
    field(:status, :string)
    @desc "Rows for the selected location dimension; empty when unavailable."
    field(:items, list_of(:analysis_web_location_metric))
    @desc "Reason the location breakdown is unavailable; null on success."
    field(:error, :analysis_web_error)
  end

  object :analysis_visitor_location_region do
    @desc "Uppercase country-prefixed region code, such as US-CA."
    field(:code, :string)
    @desc "Visitors attributed to this region in the map's reporting window."
    field(:visitors, :integer)
  end

  object :analysis_visitor_location_country do
    @desc "Uppercase two-letter country code, or OTHER for countries outside the top five."
    field(:code, :string)
    @desc "Visitors attributed to this country or to the combined OTHER group."
    field(:visitors, :integer)
    @desc "Share of visitors with valid country codes, in percent (0 to 100)."
    field(:percentage, :float)
    @desc "Up to ten regions ranked by visitors for supported countries; empty for OTHER."
    field(:regions, list_of(:analysis_visitor_location_region))
  end

  object :analysis_visitor_location_map do
    @desc "Country data availability: ok or unavailable. A region-only failure leaves the status ok."
    field(:status, :string)
    @desc "Rolling 30-day window used for the visitor map."
    field(:range, :analysis_web_range)

    @desc "Top five countries by visitor count, followed by OTHER if needed; empty when the map is disabled or unavailable."
    field(:countries, list_of(:analysis_visitor_location_country))
    @desc "Country or region lookup failure; a region failure does not discard country counts."
    field(:error, :analysis_web_error)
  end

  object :analysis_trend_traffic_section do
    @desc "Availability of the weekly heatmap: ok or unavailable."
    field(:status, :string)
    @desc "Time zone for the weekday and hour coordinates, currently UTC."
    field(:timezone, :string)
    @desc "Traffic grouped by weekday and hour across the window; empty when unavailable."
    field(:cells, list_of(:analysis_web_traffic_cell))
    @desc "Reason the heatmap is unavailable; null on success."
    field(:error, :analysis_web_error)
  end

  object :analysis_web_count_summary do
    @desc "Sum of page views across the reported paths."
    field(:pageviews, :integer)
    @desc "Sum of per-path visitor counts; a visitor can contribute to more than one path."
    field(:visitors, :integer)
    @desc "Sum of per-path visit counts; a visit can contribute to more than one path."
    field(:visits, :integer)
    @desc "Sum of bounce counts across the reported paths."
    field(:bounces, :integer)
    @desc "Sum of visit time across the reported paths, in seconds."
    field(:total_time, :integer)
  end

  object :analysis_web_timeseries_point do
    @desc "Date label for a legacy time bucket."
    field(:date, :string)
    @desc "Page views in the legacy time bucket."
    field(:pageviews, :integer)
    @desc "Visits in the legacy time bucket."
    field(:visits, :integer)
  end

  object :analysis_web_page_metric do
    @desc "URL path reported for this page."
    field(:path, :string)
    @desc "Page title if supplied by the provider."
    field(:title, :string)
    @desc "Number of views of this path, including repeat views."
    field(:pageviews, :integer)
    @desc "Visitor count reported for this path."
    field(:visitors, :integer)
    @desc "Visit count reported for this path."
    field(:visits, :integer)
    @desc "Bounce count reported for this path."
    field(:bounces, :integer)
    @desc "Total visit time reported for this path, in seconds."
    field(:total_time, :integer)
  end

  object :analysis_web_referrer_metric do
    @desc "Referring source in the legacy breakdown."
    field(:referrer, :string)
    @desc "Visitors attributed to this referrer."
    field(:visitors, :integer)
  end

  object :analysis_web_summary do
    @desc "Legacy summary availability: ready or unavailable."
    field(:status, :string)
    @desc "Analytics provider identifier, currently umami."
    field(:provider, :string)

    @desc "Community path prefix reported for legacy clients; the provider request is scoped by website ID."
    field(:path_scope, :string)
    @desc "Reporting window used for the legacy summary."
    field(:range, :analysis_web_range)
    @desc "Counts summed across reported page paths; all zero when unavailable."
    field(:summary, :analysis_web_count_summary)
    @desc "Legacy series of time buckets; the current adapter returns an empty list."
    field(:timeseries, list_of(:analysis_web_timeseries_point))
    @desc "Up to ten reported paths ranked by descending page views."
    field(:top_pages, list_of(:analysis_web_page_metric))
    @desc "Legacy visitor breakdown by referrer; the current adapter returns an empty list."
    field(:top_referrers, list_of(:analysis_web_referrer_metric))
    @desc "Reason the summary is unavailable; null when ready."
    field(:error, :string)
  end
end
