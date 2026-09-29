defmodule GroupherServer.Analysis do
  @moduledoc """
  Platform analysis context.

  Analysis groups product-facing metrics and trend DTOs by data source and
  domain dimension. `ArticleInsights` owns Groupher business metric trends;
  `Web` owns the external Web Analytics provider boundary.

  Business position:

      Application caller
        -> Analysis
        -> domain / infrastructure boundary
  """

  alias __MODULE__.Contribution
  alias __MODULE__.ArticleInsights

  @doc "Records contribution facts for the supplied user or community subject."
  defdelegate make_contribution(subject), to: Contribution

  @doc "Returns the contribution digest associated with the supplied subject."
  defdelegate list_contributions_digest(subject), to: Contribution

  @doc "Returns an authorized hourly business trend for one Article."
  defdelegate article_insights(article, viewer, opts \\ []), to: ArticleInsights, as: :trend
end
