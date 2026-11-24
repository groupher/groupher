defmodule GroupherServerWeb.Resolvers.CMS.Dashboard do
  @moduledoc """
  Adapts Dashboard GraphQL configuration fields to the CMS dashboard facade.

      GraphQL Dashboard field -> this resolver -> CMS.Dashboard facade
  """

  alias GroupherServer.CMS
  alias CMS.Model.Community

  @doc "Updates the selected community dashboard section using the submitted settings."
  def update_dashboard(
        _root,
        %{community: community, dsb_section: _key} = args,
        %{context: %{cur_user: actor}}
      ) do
    CMS.dashboard_update(community, args, actor, args[:command_id])
  end

  @doc "Sets the community dashboard's content shadow flag to the supplied boolean."
  def update_dashboard_content_shadow(
        _root,
        %{community: %Community{} = community, enabled: enabled, command_id: command_id},
        %{context: %{cur_user: actor}}
      ) do
    CMS.dashboard_update(community, :content_shadow, enabled, actor, command_id)
  end

  @doc "Saves the supplied custom theme preset for the community and actor."
  def save_custom_theme_preset(
        _root,
        %{community: community} = args,
        %{context: %{cur_user: actor}}
      ) do
    CMS.dashboard_save_custom_theme_preset(community, args, actor, args[:command_id])
  end

  @doc "Selects the requested theme preset for the community dashboard."
  def select_theme_preset(
        _root,
        %{community: community} = args,
        %{context: %{cur_user: actor}}
      ) do
    CMS.dashboard_select_theme_preset(community, args, actor, args[:command_id])
  end
end
