defmodule GroupherServer.CMS.Dashboard.Commands.SaveCustomThemePreset do
  @moduledoc """
  Saves a composed custom theme under Community Gate admission.

      Dashboard facade
        -> SaveCustomThemePreset.execute
        -> CMS.Gate community transaction
        -> ThemePresets + Dashboard.Persist
  """

  alias GroupherServer.CMS
  alias CMS.Dashboard.{Effects, Persist, ThemePresets}
  alias CMS.Model.{Community, CommunityDashboard}
  alias Helper.T

  @doc """
  Saves a custom theme preset as one authenticated dashboard command.

  ## Examples

      execute(...)
      #=> {:ok, value}
  """
  @spec execute(Community.t(), map(), term(), Ecto.UUID.t()) :: T.domain_res(CommunityDashboard.t())
  def execute(%Community{} = community, args, actor, command_id) do
    CMS.Gate.with_community_check(actor, :update, community, fn canonical ->
      args = Map.delete(args, :command_id)

      with {:ok, dashboard} <- Persist.get_or_insert_dashboard(canonical),
           {:ok, updated} <- ThemePresets.save_custom(dashboard, args),
           {:ok, _event} <- Effects.enqueue_presentation_changed(canonical, command_id) do
        {:ok, updated}
      end
    end)
  end
end
