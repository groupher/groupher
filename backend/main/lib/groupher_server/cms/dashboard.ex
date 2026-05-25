defmodule GroupherServer.CMS.Dashboard do
  @moduledoc """
  CMS dashboard facade.
  """

  alias GroupherServer.CMS.Dashboard.{ThemePresets, Write}
  alias GroupherServer.CMS.Model.{Community, CommunityDashboard}
  alias Helper.T

  @doc """
  update dashboard settings of a community
  """
  @spec update(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, args), do: Write.update(community, args)

  @spec update(Community.t(), atom(), map() | list()) :: T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, key, args), do: Write.update(community, key, args)

  @spec save_custom_theme_preset(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def save_custom_theme_preset(%Community{} = community, args),
    do: ThemePresets.save_custom(community, args)

  @spec select_theme_preset(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def select_theme_preset(%Community{} = community, args),
    do: ThemePresets.select(community, args)
end
