defmodule GroupherServerWeb.Resolvers.CMS.ArtimentMentions do
  @moduledoc """
  Adapts mention GraphQL locators to the ArtimentMentions facade.

      GraphQL mention field -> this resolver -> CMS.ArtimentMentions facade
  """

  alias GroupherServer.CMS

  def trashed_article_mentioned_by(item, args, _info) do
    CMS.ArtimentMentions.mentioned_by(item.thread, item.article.id, Map.get(args, :filter))
  end

  def trashed_article_mentions(item, args, _info) do
    CMS.ArtimentMentions.mentions(item.thread, item.article.id, Map.get(args, :filter))
  end

  def mentions(_root, %{source: source} = args, _info) do
    CMS.ArtimentMentions.mentions(source, Map.get(args, :filter))
  end

  def mentioned_by(_root, %{target: target} = args, _info) do
    CMS.ArtimentMentions.mentioned_by(target, Map.get(args, :filter))
  end
end
