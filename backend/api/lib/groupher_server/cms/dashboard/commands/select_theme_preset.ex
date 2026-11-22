defmodule GroupherServer.CMS.Dashboard.Commands.SelectThemePreset do
  @moduledoc """
  Selects a dashboard theme preset under Community Gate admission.

      Dashboard facade
        -> SelectThemePreset.execute
        -> CMS.Gate community transaction
        -> ThemePresets + Dashboard.Persist
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.CMS
  alias CMS.Dashboard.{Effects, Persist, ThemePresets}
  alias CMS.Model.{Community, CommunityDashboard}
  alias Helper.T

  @doc """
  Selects a built-in or previously saved custom theme preset.

  ## Examples

      execute(...)
      #=> {:ok, value}
  """
  @spec execute(Community.t(), map(), term(), Ecto.UUID.t()) ::
          T.domain_res(CommunityDashboard.t())
  @pipeline operation: :dashboard_select_theme_preset,
            operation_ref: :command_id,
            target: :community
  direct_pipeline execute(community, args, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :update, candidate) end)

    change(fn canonical, operation_ref ->
      args = Map.delete(args, :command_id)

      with {:ok, dashboard} <- Persist.get_or_insert_dashboard(canonical),
           {:ok, updated} <- ThemePresets.select(dashboard, args),
           {:ok, _event} <- Effects.enqueue_presentation_changed(canonical, operation_ref) do
        {:ok, updated}
      end
    end)
  end
end
