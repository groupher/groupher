defmodule GroupherServerWeb.Resolvers.CMS.ArtimentMentions do
  @moduledoc """
  Adapts mention GraphQL locators to the ArtimentMentions facade.

      GraphQL mention field -> this resolver -> CMS.ArtimentMentions facade
  """

  alias GroupherServer.Pagi
  alias GroupherServer.CMS

  @doc "Pages outgoing mentions from the typed source locator in a community."
  def mentions(_root, %{community: community, source: source} = args, _info) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi), 20) do
      CMS.mentions(community, %{type: source.type, locator: source}, pagi)
    end
  end

  @doc "Pages incoming mentions of the target in a community."
  def mentioned_by(_root, %{community: community, target: target} = args, _info) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi), 20) do
      CMS.mentioned_by(community, target, pagi)
    end
  end

  @doc "Reads a cursor page of the mention graph around the requested focus."
  def mentions_graph(_root, %{community: community, focus: focus} = args, _info) do
    CMS.mentions_graph_page(community, focus, Map.get(args, :after), Map.get(args, :first, 20))
  end

  @doc "Returns the revision of the community mention graph for the requested focus."
  def mentions_graph_revision(_root, %{community: community, focus: focus}, _info) do
    CMS.mentions_graph_revision(community, focus)
  end

  @doc "Pages article comments for the graph focus using the supplied cursor and limit."
  def mentions_graph_article_comments(_root, %{community: community, focus: focus} = args, _info) do
    CMS.mentions_graph_article_comments(
      community,
      focus,
      Map.get(args, :after),
      Map.get(args, :first, 20)
    )
  end
end
