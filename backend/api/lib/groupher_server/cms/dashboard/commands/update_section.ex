defmodule GroupherServer.CMS.Dashboard.Commands.UpdateSection do
  @moduledoc """
  Updates one dashboard section under Community Gate admission.

      Dashboard facade
        -> UpdateSection.execute
        -> CMS.Gate community transaction
        -> Community identity + Dashboard.Persist
        -> presentation Outbox intent
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.CMS
  alias CMS.Dashboard.{BaseInfo, Effects, PagiMode, SectionPayload, Persist}
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
  @pipeline operation: :dashboard_update_section,
            operation_ref: :command_id,
            target: :community
  direct_pipeline execute(community, key, args, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(actor, :update, candidate) end)

    change(fn canonical, operation_ref ->
      args = if is_map(args), do: Map.delete(args, :command_id), else: args
      section_args = section_args(key, args)

      write = fn ->
        with {:ok, dashboard} <- dashboard_for_update(canonical, key),
             {:ok, canonical} <- maybe_update_identity(canonical, key, args),
             {:ok, updated} <- update_dashboard(dashboard, key, section_args),
             {:ok, _event} <- enqueue_effect(canonical, key, section_args, operation_ref) do
          {:ok, updated}
        end
      end

      if key in [:doc_faq, :layout, :enable] do
        CMS.DocTree.Publication.Presentation.write(canonical, operation_ref, write)
      else
        write.()
      end
    end)
  end

  defp dashboard_for_update(community, :enable) do
    case Persist.get_dashboard(community) do
      {:ok, dashboard} -> {:ok, dashboard}
      {:error, _reason} -> {:error, CMS.ErrorCat.dashboard_not_found()}
    end
  end

  defp dashboard_for_update(community, _key), do: Persist.get_or_insert_dashboard(community)

  defp maybe_update_identity(community, :base_info, args) do
    CMS.Communities.Persist.update_identity_fields(community, args)
  end

  defp maybe_update_identity(community, _key, _args), do: {:ok, community}

  defp section_args(:content_shadow, args), do: args

  defp section_args(:pagi_mode, args) when is_map(args) do
    Map.drop(args, [:community, :dsb_section, :command_id])
  end

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

  defp update_dashboard(dashboard, :content_shadow, enabled) do
    Persist.update_content_shadow(dashboard, enabled)
  end

  defp update_dashboard(dashboard, :pagi_mode, %{
         mode: mode,
         mobile_mode: mobile_mode,
         expected_revision: revision
       }) do
    Persist.update_pagi_mode(dashboard, mode, mobile_mode, revision)
  end

  defp update_dashboard(_dashboard, :pagi_mode, _args) do
    {:error, GroupherServer.Pagi.invalid_config_context()}
  end

  defp update_dashboard(dashboard, key, args), do: Persist.replace_section(dashboard, key, args)

  defp enqueue_effect(community, :pagi_mode, _args, command_id) do
    with {:ok, _} <- PagiMode.invalidate(community.slug) do
      Effects.enqueue_pagi_mode_changed(community, command_id)
    end
  end

  defp enqueue_effect(community, _key, _args, command_id) do
    Effects.enqueue_presentation_changed(community, command_id)
  end
end
