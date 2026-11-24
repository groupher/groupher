defmodule GroupherServer.CMS.Communities.Tags do
  @moduledoc """
  Internal facade for Community taxonomy queries and statistics.

      caller -> GroupherServer.CMS.Communities.Tags -> result
  """

  alias __MODULE__.{Query, Stats}

  @doc "Increments a tag's usage statistic for an Article."
  defdelegate inc(article, tag), to: Stats
  @doc "Decrements a tag's usage statistic for an Article."
  defdelegate dec(article, tag), to: Stats
  @doc "Applies multiple tag-statistic deltas for one Article."
  defdelegate update_many(article, deltas), to: Stats
  @doc "Rebuilds the stored statistic for a tag from its Articles."
  defdelegate rebuild(tag), to: Stats
  @doc "Loads tag statistics by tag reference."
  defdelegate get_stats(tag), to: Stats, as: :get
  @doc "Loads tag statistics by Community, thread, and tag slug."
  defdelegate get_stats(community, thread, slug), to: Stats, as: :get
  @doc "Returns tag-group titles keyed by group ID."
  defdelegate group_titles(ids), to: Query
  @doc "Lists tag groups and their ordered tags for the supplied filter."
  defdelegate groups(filter), to: Query
end
