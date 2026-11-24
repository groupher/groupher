defmodule GroupherServerWeb.Resolvers.CMS.Analysis do
  @moduledoc """
  Adapts analytics GraphQL fields to Analysis read facades and their error contracts.

      GraphQL analysis field -> this resolver -> Analysis facade/provider
  """

  alias GroupherServer.CMS

  alias GroupherServer.Analysis

  alias CMS.Model.Community

  @doc "Reads the article insights trend using its public path, filters, and optional viewer."
  def article_insights(_root, %{article: article_path} = args, info) do
    viewer = Map.get(info.context, :cur_user)
    Analysis.article_insights_trend_by_public_filter(article_path, viewer, args)
  end

  @doc "Returns a community's web analytics summary for the requested query parameters."
  def analysis_web_summary(_root, %{community: %Community{} = community} = args, _info) do
    GroupherServer.Analysis.web_summary(community, args)
  end

  @doc "Looks up the tracking website ID used for the community's web analytics."
  def analysis_tracking_website_id(_root, %{community: %Community{} = community}, _info) do
    GroupherServer.Analysis.web_tracking_website_id(community)
  end

  @doc "Returns the community's geographic distribution of visitors."
  def analysis_visitor_location_map(_root, %{community: %Community{} = community}, _info) do
    GroupherServer.Analysis.web_visitor_location_map(community)
  end

  @doc "Returns the community's web trend overview for the requested filters."
  def analysis_trends_overview(_root, %{community: %Community{} = community} = args, _info) do
    GroupherServer.Analysis.web_trends_overview(community, args)
  end

  @doc "Reads the active visitor metric shown on the community dashboard."
  def analysis_active_visitors(_root, %{community: %Community{} = community}, _info) do
    GroupherServer.Analysis.web_active_for_dashboard(community)
  end

  @doc "Breaks down page trends by the requested page dimension."
  def analysis_trend_pages(
        _root,
        %{community: %Community{} = community, dimension: dimension} = args,
        _info
      ) do
    GroupherServer.Analysis.web_trend_pages(community, args, dimension)
  end

  @doc "Breaks down acquisition trends by the requested traffic source dimension."
  def analysis_trend_sources(
        _root,
        %{community: %Community{} = community, dimension: dimension} = args,
        _info
      ) do
    GroupherServer.Analysis.web_trend_sources(community, args, dimension)
  end

  @doc "Breaks down visitor trends by the requested client environment dimension."
  def analysis_trend_environment(
        _root,
        %{community: %Community{} = community, dimension: dimension} = args,
        _info
      ) do
    GroupherServer.Analysis.web_trend_environment(community, args, dimension)
  end

  @doc "Breaks down visitor trends by the requested geographic dimension."
  def analysis_trend_location(
        _root,
        %{community: %Community{} = community, dimension: dimension} = args,
        _info
      ) do
    GroupherServer.Analysis.web_trend_location(community, args, dimension)
  end

  @doc "Returns the community's traffic trend for the supplied query parameters."
  def analysis_trend_traffic(_root, %{community: %Community{} = community} = args, _info) do
    GroupherServer.Analysis.web_trend_traffic(community, args)
  end
end
