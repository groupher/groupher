defmodule GroupherServer.Analysis.ArticleInsights do
  @moduledoc """
  Public facade for authorized Article business metric trends.

      Analysis facade
        -> ArticleInsights facade
        -> ArticleInsights.Query
        -> CMS Gate + hourly projection

  Query owns authorization-aware loading and projection reads. This facade
  keeps callers independent from persistence and projection implementation.
  """

  alias __MODULE__.Query

  @doc """
  Returns an authorized Article hourly trend with zero-filled buckets.

  ## Examples

      Analysis.ArticleInsights.trend(article, viewer, metrics: [:views])
  """
  @spec trend(map(), term(), keyword()) :: {:ok, map()} | {:error, term()}
  defdelegate trend(article, viewer, opts \\ []), to: Query

  @doc """
  Resolves a public Article path and returns its authorized trend.

  ## Examples

      Analysis.ArticleInsights.trend_by_path(article_path, viewer, [])
  """
  @spec trend_by_path(map(), term(), keyword()) :: {:ok, map()} | {:error, term()}
  defdelegate trend_by_path(article_path, viewer, opts \\ []), to: Query

  @doc """
  Normalizes the public Insights filter and returns its authorized trend.

  ## Examples

      Analysis.ArticleInsights.trend_by_public_filter(article_path, viewer, %{metrics: [:views]})
  """
  @spec trend_by_public_filter(map(), term(), map()) :: {:ok, map()} | {:error, term()}
  defdelegate trend_by_public_filter(article_path, viewer, filter), to: Query

  @doc """
  Returns the current closed metric vocabulary for Article Insights.

  ## Examples

      Analysis.ArticleInsights.metrics()
  """
  @spec metrics() :: [atom()]
  defdelegate metrics(), to: Query

  @doc """
  Extracts community-scoped insight grants at the trusted API boundary.

  ## Examples

      Analysis.ArticleInsights.passport_granted_community_slugs(viewer)
  """
  @spec passport_granted_community_slugs(term()) :: {:ok, [String.t()]} | {:error, term()}
  defdelegate passport_granted_community_slugs(viewer), to: Query
end
