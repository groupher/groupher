defmodule GroupherServerWeb.Resolvers.CMS.Press do
  @moduledoc """
  Adapts Press configuration and publication fields to the CMS Press facade.

      GraphQL Press field -> this resolver -> CMS.Press facade
  """

  alias GroupherServer.CMS

  @doc "Reads Press publication settings for the requested community."
  def press_config(_root, %{community: community}, _info) do
    CMS.press_config(community)
  end

  @doc "Updates the community's Press settings and returns the saved settings under the config key."
  def update_press_config(
        _root,
        %{input: %{community: community} = input, command_id: command_id},
        %{
          context: %{cur_user: actor}
        }
      ) do
    input = Map.delete(input, :community)

    with {:ok, config} <- CMS.press_update_config(community, input, actor, command_id) do
      {:ok, %{config: config}}
    end
  end

  @doc "Parses a public article path before loading its Press representation."
  def press_article(_root, %{article: article_path}, _info) do
    with {:ok, article_path} <- CMS.parse_article_path(article_path) do
      CMS.press_article(article_path)
    end
  end

  @doc "Reads the community-wide RSS feed using the supplied feed options."
  def press_community_rss_feed(_root, %{community: community, input: input}, _info) do
    CMS.press_community_rss_feed(community, input)
  end

  @doc "Reads an RSS feed scoped to one thread in the requested community."
  def press_thread_rss_feed(
        _root,
        %{community: community, thread: thread, input: input},
        _info
      ) do
    CMS.press_thread_rss_feed(community, thread, input)
  end

  @doc "Reads the Press site manifest for the requested community."
  def press_site_manifest(_root, %{community: community}, _info) do
    CMS.press_site_manifest(community)
  end
end
