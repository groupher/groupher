defmodule GroupherServer.CMS.Dashboard.Commands.UpdateSection do
  @moduledoc """
  Updates one dashboard section under Community Gate admission.

      Dashboard facade
        -> UpdateSection.execute
        -> CMS.Gate community transaction
        -> Community identity + Dashboard.Persist
        -> presentation Outbox intent
  """

  alias GroupherServer.CMS
  alias CMS.Dashboard.BaseInfo
  alias CMS.Dashboard.Effects
  alias CMS.Dashboard.SectionPayload
  alias CMS.Dashboard.Persist
  alias CMS.Model.{Community, CommunityDashboard}
  alias Helper.T

  @doc """
  Updates one dashboard section as an authenticated domain command.

  ## Examples

      execute(...)
      #=> {:ok, value}
  """
  @spec execute(Community.t(), atom(), map() | list() | boolean(), term(), Ecto.UUID.t()) ::
          T.domain_res(CommunityDashboard.t())
  def execute(%Community{} = community, key, args, actor, command_id) do
    CMS.Gate.with_community_check(actor, :update, community, fn canonical ->
      args = if is_map(args), do: Map.delete(args, :command_id), else: args
      section_args = section_args(key, args)

      with {:ok, dashboard} <- Persist.get_or_insert_dashboard(canonical),
           {:ok, canonical} <- maybe_update_identity(canonical, key, args),
           {:ok, updated} <- update_dashboard(dashboard, key, section_args),
           {:ok, _event} <- Effects.enqueue_presentation_changed(canonical, command_id) do
        {:ok, updated}
      end
    end)
  end

  defp maybe_update_identity(community, :base_info, args) do
    CMS.Communities.Persist.update_identity_fields(community, args)
  end

  defp maybe_update_identity(community, _key, _args), do: {:ok, community}

  defp section_args(:content_shadow, args), do: args

  defp section_args(key, args) when is_map(args) do
    if Map.has_key?(args, :dsb_section) or Map.has_key?(args, :community) or
         Map.has_key?(args, key) do
      SectionPayload.section_args(key, args)
    else
      args
    end
  end

  defp section_args(_key, args), do: args

  defp update_dashboard(dashboard, :base_info, args) do
    args = Map.merge(args, BaseInfo.take_community_fields(args))
    Persist.replace_section(dashboard, :base_info, args)
  end

  defp update_dashboard(dashboard, :content_shadow, enabled),
    do: Persist.update_content_shadow(dashboard, enabled)

  defp update_dashboard(dashboard, key, args), do: Persist.replace_section(dashboard, key, args)
end
