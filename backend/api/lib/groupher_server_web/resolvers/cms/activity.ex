defmodule GroupherServerWeb.Resolvers.CMS.Activity do
  @moduledoc """
  Adapts activity GraphQL reads to the Activity facade.

      GraphQL activity field -> this resolver -> Activity facade
  """

  alias GroupherServer.Activity
  alias GroupherServer.CMS.Model.Community

  def article_logs(_root, %{article: article} = args, info) do
    actor = Map.get(info.context, :cur_user)
    filter = Map.get(args, :filter, %{})
    Activity.list_article_logs(article, actor, filter)
  end

  def community_activity(_root, %{community: %Community{} = community} = args, info) do
    actor = Map.get(info.context, :cur_user)
    Activity.list_community_logs(community, actor, args.selection, args.page)
  end

  def community_activity_stats(
        _root,
        %{community: %Community{} = community, selection: selection},
        info
      ) do
    actor = Map.get(info.context, :cur_user)
    Activity.get_community_log_stats(community, actor, selection)
  end

  def community_activity_config(_root, %{community: %Community{} = community}, info) do
    Activity.get_community_log_config(community, Map.get(info.context, :cur_user))
  end

  def export_community_activity(
        _root,
        %{community: %Community{} = community, format: format} = args,
        info
      ) do
    Activity.export_community_logs(
      community,
      Map.get(info.context, :cur_user),
      args.selection,
      format
    )
  end

  def community_activity_event(
        _root,
        %{community: %Community{} = community, event_ref: event_ref},
        info
      ) do
    Activity.get_community_log_event(community, Map.get(info.context, :cur_user), event_ref)
  end
end
