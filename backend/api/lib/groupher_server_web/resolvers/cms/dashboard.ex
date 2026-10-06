defmodule GroupherServerWeb.Resolvers.CMS.Dashboard do
  @moduledoc """
  Adapts Dashboard GraphQL configuration fields to the CMS dashboard facade.

      GraphQL Dashboard field -> this resolver -> CMS.Dashboard facade
  """

  alias GroupherServer.CMS
  alias GroupherServer.CMS.Model.Community

  def update_dashboard(_root, %{community: community, dsb_section: _key} = args, _info) do
    CMS.Dashboard.update(community, args)
  end

  def update_dashboard_content_shadow(
        _root,
        %{community: %Community{} = community, enabled: enabled},
        _info
      ) do
    CMS.Dashboard.update(community, :content_shadow, enabled)
  end

  def save_custom_theme_preset(_root, %{community: community} = args, _info) do
    CMS.Dashboard.save_custom_theme_preset(community, args)
  end

  def select_theme_preset(_root, %{community: community} = args, _info) do
    CMS.Dashboard.select_theme_preset(community, args)
  end
end
