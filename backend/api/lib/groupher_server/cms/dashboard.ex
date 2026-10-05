defmodule GroupherServer.CMS.Dashboard do
  @moduledoc """
  Public CMS boundary for persisted community dashboard settings and theme presets.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Dashboard
        -> Repo / external boundary
  """

  alias GroupherServer.CMS

  alias CMS.Dashboard.{ThemePresets, Writer}
  alias CMS.Model.{Community, CommunityDashboard}
  alias Helper.T

  @doc """
  update dashboard settings of a community
  """
  @spec update(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, args), do: Writer.update(community, args)

  @spec update(Community.t(), atom(), map() | list() | boolean()) ::
          T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, key, args), do: Writer.update(community, key, args)

  @doc "Runs `save_custom_theme_preset` through the public `Dashboard` boundary."
  @spec save_custom_theme_preset(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def save_custom_theme_preset(%Community{} = community, args) do
    ThemePresets.save_custom(community, args)
  end

  @doc "Runs `select_theme_preset` through the public `Dashboard` boundary."
  @spec select_theme_preset(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def select_theme_preset(%Community{} = community, args) do
    ThemePresets.select(community, args)
  end
end
