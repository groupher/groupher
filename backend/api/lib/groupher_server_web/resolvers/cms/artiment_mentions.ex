defmodule GroupherServerWeb.Resolvers.CMS.ArtimentMentions do
  @moduledoc """
  Adapts mention GraphQL locators to the ArtimentMentions facade.

      GraphQL mention field -> this resolver -> CMS.ArtimentMentions facade
  """

  alias GroupherServer.Pagi
  alias GroupherServer.CMS

  def mentions(_root, %{community: community, source: source} = args, _info) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi), 20) do
      CMS.mentions(community, %{type: source.type, locator: source}, pagi)
    end
  end

  def mentioned_by(_root, %{community: community, target: target} = args, _info) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi), 20) do
      CMS.mentioned_by(community, target, pagi)
    end
  end

  def mentions_graph(_root, %{community: community, focus: focus} = args, _info) do
    CMS.mentions_graph_page(community, focus, Map.get(args, :after), Map.get(args, :first, 20))
  end

  def mentions_graph_revision(_root, %{community: community, focus: focus}, _info) do
    CMS.mentions_graph_revision(community, focus)
  end

  def mentions_graph_article_comments(_root, %{community: community, focus: focus} = args, _info) do
    CMS.mentions_graph_article_comments(
      community,
      focus,
      Map.get(args, :after),
      Map.get(args, :first, 20)
    )
  end
end
