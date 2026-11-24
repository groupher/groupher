defmodule GroupherServerWeb.Resolvers.CMS.ArticleStats do
  @moduledoc """
  Exposes stable ArticleStats projections through GraphQL fields.

      GraphQL stats field -> this resolver -> CMS.ArticleStats facade
  """

  alias GroupherServer.CMS

  @doc "Reads public article statistics for a batch of inner IDs in one community and thread."
  def article_stats(
        _root,
        %{community: community, thread: thread, inner_ids: inner_ids},
        _info
      ) do
    CMS.article_stats_read_public(community, thread, inner_ids)
  end
end
