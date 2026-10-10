defmodule GroupherServerWeb.Resolvers.CMS.Dashboard do
  @moduledoc """
  Adapts Dashboard GraphQL configuration fields to the CMS dashboard facade.

      GraphQL Dashboard field -> this resolver -> CMS.Dashboard facade
  """

  alias GroupherServer.CMS
  alias GroupherServer.CMS.Model.Community

  def update_dashboard(
        _root,
        %{community: community, dsb_section: _key} = args,
        %{context: %{cur_user: actor}}
      ) do
    CMS.Dashboard.update(community, args, actor, args[:command_id])
  end

  def update_dashboard_content_shadow(
        _root,
        %{community: %Community{} = community, enabled: enabled, command_id: command_id},
        %{context: %{cur_user: actor}}
      ) do
    CMS.Dashboard.update(community, :content_shadow, enabled, actor, command_id)
  end

  def save_custom_theme_preset(
        _root,
        %{community: community} = args,
        %{context: %{cur_user: actor}}
      ) do
    CMS.Dashboard.save_custom_theme_preset(community, args, actor, args[:command_id])
  end

  def select_theme_preset(
        _root,
        %{community: community} = args,
        %{context: %{cur_user: actor}}
      ) do
    CMS.Dashboard.select_theme_preset(community, args, actor, args[:command_id])
  end
end
