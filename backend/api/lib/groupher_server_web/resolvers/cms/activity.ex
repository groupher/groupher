defmodule GroupherServerWeb.Resolvers.CMS.Activity do
  @moduledoc """
  Adapts activity GraphQL reads to the Activity facade.

      GraphQL activity field -> this resolver -> Activity facade
  """

  alias GroupherServer.Pagi
  alias GroupherServer.CMS

  alias GroupherServer.Activity
  alias CMS.Model.Community

  @doc "Pages the activity log for the resolved article and optional viewer."
  def article_logs(_root, %{article: article} = args, info) do
    actor = Map.get(info.context, :cur_user)

    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Activity.list_article_logs(article, actor, pagi)
    end
  end

  @doc "Pages the selected community activity using the viewer and supplied community Passport scope."
  def community_activity(_root, %{community: %Community{} = community} = args, info) do
    actor = Map.get(info.context, :cur_user)

    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      passport_scope = get_in(args, [:passport_scopes, :community])

      Activity.list_community_logs(community, actor, args.selection, pagi,
        passport_scope: passport_scope
      )
    end
  end

  @doc "Returns community activity statistics for the viewer's selection."
  def community_activity_stats(
        _root,
        %{community: %Community{} = community, selection: selection} = args,
        info
      ) do
    actor = Map.get(info.context, :cur_user)
    scope = get_in(args, [:passport_scopes, :community])
    Activity.get_community_log_stats(community, actor, selection, passport_scope: scope)
  end

  @doc "Loads the community activity log configuration for the requesting viewer."
  def community_activity_config(_root, %{community: %Community{} = community}, info) do
    Activity.get_community_log_config(community, Map.get(info.context, :cur_user))
  end

  @doc "Exports the selected community events in the requested format for the viewer."
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

  @doc "Looks up a single community activity event by reference for the viewer."
  def community_activity_event(
        _root,
        %{community: %Community{} = community, event_ref: event_ref},
        info
      ) do
    Activity.get_community_log_event(community, Map.get(info.context, :cur_user), event_ref)
  end
end
