defmodule GroupherServerWeb.Resolvers.CMS.ArtimentMentions do
  @moduledoc """
  Adapts mention GraphQL locators to the ArtimentMentions facade.

      GraphQL mention field -> this resolver -> CMS.ArtimentMentions facade
  """

  alias GroupherServer.Pagi
  alias GroupherServer.CMS

  def mentions(_root, %{community: community, source: source} = args, _info) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.artiment_mentions_public_mentions(community, source, pagi)
    end
  end

  def mentioned_by(_root, %{community: community, target: target} = args, _info) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.artiment_mentions_public_mentioned_by(community, target, pagi)
    end
  end

  def reference_map(
        _root,
        %{community: community, focus: focus, frontiers: frontiers} = args,
        _info
      ) do
    CMS.reference_map_page(community, focus, frontiers, Map.get(args, :first, 20))
  end

  def reference_map_article_comments(_root, %{community: community, focus: focus} = args, _info) do
    CMS.reference_map_article_comments(
      community,
      focus,
      Map.get(args, :after),
      Map.get(args, :first, 20)
    )
  end

  def reference_map_revision(_root, %{community: community, focus: focus}, _info) do
    CMS.reference_map_revision(community, focus)
  end
end
