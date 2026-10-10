defmodule GroupherServerWeb.Resolvers.CMS.Analysis do
  @moduledoc """
  Adapts analytics GraphQL fields to Analysis read facades and their error contracts.

      GraphQL analysis field -> this resolver -> Analysis facade/provider
  """

  alias GroupherServer.Analysis
  alias GroupherServer.Analysis.Web, as: AnalysisWeb
  alias GroupherServer.CMS.Model.Community

  def article_insights(_root, %{article: article_path} = args, info) do
    viewer = Map.get(info.context, :cur_user)
    Analysis.ArticleInsights.trend_by_public_filter(article_path, viewer, args)
  end

  def analysis_web_summary(_root, %{community: %Community{} = community} = args, _info) do
    AnalysisWeb.summary(community, args)
  end

  def analysis_tracking_website_id(_root, %{community: %Community{} = community}, _info) do
    AnalysisWeb.tracking_website_id(community)
  end

  def analysis_visitor_location_map(_root, %{community: %Community{} = community}, _info) do
    AnalysisWeb.visitor_location_map(community)
  end

  def analysis_trends_overview(_root, %{community: %Community{} = community} = args, _info) do
    AnalysisWeb.trends_overview(community, args)
  end

  def analysis_active_visitors(_root, %{community: %Community{} = community}, _info) do
    AnalysisWeb.active_for_dashboard(community)
  end

  def analysis_trend_pages(
        _root,
        %{community: %Community{} = community, dimension: dimension} = args,
        _info
      ) do
    AnalysisWeb.trend_pages(community, args, dimension)
  end

  def analysis_trend_sources(
        _root,
        %{community: %Community{} = community, dimension: dimension} = args,
        _info
      ) do
    AnalysisWeb.trend_sources(community, args, dimension)
  end

  def analysis_trend_environment(
        _root,
        %{community: %Community{} = community, dimension: dimension} = args,
        _info
      ) do
    AnalysisWeb.trend_environment(community, args, dimension)
  end

  def analysis_trend_location(
        _root,
        %{community: %Community{} = community, dimension: dimension} = args,
        _info
      ) do
    AnalysisWeb.trend_location(community, args, dimension)
  end

  def analysis_trend_traffic(_root, %{community: %Community{} = community} = args, _info) do
    AnalysisWeb.trend_traffic(community, args)
  end
end
