defmodule GroupherServer.CMS.Dashboard.ThemePresets do
  @moduledoc false

  alias GroupherServer.CMS.Dashboard.{ThemePreset, Write}
  alias GroupherServer.CMS.Model.{Community, CommunityDashboard, Embeds}
  alias Helper.T

  @spec save_custom(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def save_custom(%Community{} = community, args) do
    args = Map.drop(args, [:community])

    with :ok <- validate_custom_save(args),
         {:ok, community_dashboard} <- Write.ensure_exist(community),
         current_layout <- current_layout(community_dashboard),
         {:ok, custom_theme_preset} <- merge_custom_theme_preset(current_layout, args),
         args <-
           args
           |> Map.drop([:theme_preset_base, :theme_overwrite])
           |> Map.put(:custom_theme_preset, custom_theme_preset) do
      Write.replace_section(community_dashboard, :layout, args)
    end
  end

  @spec select(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def select(%Community{} = community, %{theme_preset: :custom} = args) do
    args = Map.drop(args, [:community])

    with {:ok, community_dashboard} <- Write.ensure_exist(community),
         current_layout <- current_layout(community_dashboard),
         true <- is_map(current_layout.custom_theme_preset) do
      Write.update_section(community, :layout, args)
    else
      false -> {:error, "custom theme preset has not been created"}
      error -> error
    end
  end

  def select(%Community{} = community, args) do
    args = Map.drop(args, [:community])

    Write.update_section(community, :layout, args)
  end

  defp current_layout(community_dashboard) do
    community_dashboard.layout ||
      struct(Embeds.Dashboard.Layout, Embeds.Dashboard.Layout.default())
  end

  defp validate_custom_save(%{theme_preset: :custom, theme_preset_base: :custom}),
    do: {:error, "saveCustomThemePreset requires a read-only themePresetBase"}

  defp validate_custom_save(%{theme_preset: :custom}), do: :ok

  defp validate_custom_save(_), do: {:error, "saveCustomThemePreset only accepts CUSTOM preset"}

  defp merge_custom_theme_preset(current_layout, args) do
    current_custom_preset = current_layout.custom_theme_preset
    current_base_preset = ThemePreset.custom_base_preset(current_custom_preset)
    base_preset = Map.get(args, :theme_preset_base, current_base_preset)
    # GraphQL allows `themeOverwrite: null`; treat it the same as an omitted or
    # empty overwrite so reset/preserve semantics stay consistent.
    incoming_overwrite = Map.get(args, :theme_overwrite) || %{}

    # Custom existence is stored by the nullable `custom_theme_preset` map, not
    # by overwrite size. Empty overwrite means "reset Custom" when already
    # editing Custom, but "restore existing Custom" when selecting Custom from a
    # readonly preset.
    existing_overwrite =
      cond do
        custom_selected?(current_layout.theme_preset) and incoming_overwrite == %{} ->
          %{}

        is_map(current_custom_preset) and current_base_preset == base_preset ->
          ThemePreset.custom_overwrite(current_custom_preset)

        true ->
          %{}
      end

    with {:ok, overwrite} <-
           ThemePreset.merge_overwrite(base_preset, existing_overwrite, incoming_overwrite) do
      {:ok, ThemePreset.build_custom_preset(base_preset, overwrite)}
    end
  end

  defp custom_selected?(theme_preset), do: theme_preset in [:custom, "custom", "CUSTOM"]
end
