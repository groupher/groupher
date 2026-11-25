defmodule GroupherServer.CMS.Insights do
  @moduledoc """
  Internal CMS boundary for resolving and authorizing Article Insights reads.

      CMS facade
        -> CMS.Insights
        -> CMS.Insights.Query
        -> Gate + CMS persistence
  """

  alias __MODULE__.Query

  @doc "Returns communities where the viewer has the Insights Passport grant."
  defdelegate passport_granted_community_slugs(viewer), to: Query

  @doc "Returns the CMS Article type used by the Analysis projection."
  @spec article_type(map()) :: {:ok, atom()} | {:error, term()}
  defdelegate article_type(article), to: Query

  @doc "Authorizes an already loaded Article for Insights reads."
  @spec authorize(map(), term(), atom(), keyword()) :: {:ok, :pass} | {:error, term()}
  defdelegate authorize(article, viewer, article_type, opts), to: Query

  @doc "Resolves and authorizes a public Article path for an Insights read."
  @spec resolve(map(), term(), keyword()) :: {:ok, map()} | {:error, term()}
  defdelegate resolve(article_path, viewer, opts), to: Query
end
