defmodule GroupherServer.CMS.Dashboard.ThemePresets do
  @moduledoc """
  Handles dashboard theme preset selection and custom preset persistence.

  Custom themes are stored as a composed preset in the layout section, with the
  read-only base preset plus the user overwrite. Selecting a preset updates only
  layout state; saving a custom preset composes the durable custom payload first.

      save custom
          |
          v
      current layout + base preset + incoming overwrite
          |
          v
      layout.custom_theme_preset

  Business position:

      Dashboard UI
        -> GraphQL
        -> CMS.Dashboard
        -> ThemePresets
        -> CommunityDashboard / Repo
  """

  alias GroupherServer.CMS

  alias CMS.Dashboard.{Persist, ThemePreset}
  alias CMS.Model.{Community, CommunityDashboard}
  alias CMS.Model.Embeds.Dashboard.Layout
  alias Helper.T

  @doc """
  Composes and persists a custom theme preset for a community layout.

  The incoming overwrite is merged onto the current custom preset before the
  composed `custom_theme_preset` is saved in the layout section.

  ## Examples

      ThemePresets.save_custom(community, %{theme_preset: :custom, theme_preset_base: :claude, theme_overwrite: %{"light" => %{"cardColor" => "#ffffff"}}})
      #=> {:ok, %CommunityDashboard{}}

  """
  @spec save_custom(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def save_custom(%Community{} = community, args) do
    with {:ok, dashboard} <- Persist.get_or_insert_dashboard(community) do
      save_custom(dashboard, args)
    end
  end

  @spec save_custom(CommunityDashboard.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def save_custom(%CommunityDashboard{} = community_dashboard, args) do
    args = Map.drop(args, [:community])

    with {:ok, _} <- validate_custom_save(args),
         current_layout <- current_layout(community_dashboard),
         {:ok, custom_theme_preset} <- merge_custom_theme_preset(current_layout, args),
         args <-
           args
           |> Map.drop([:theme_preset_base, :theme_overwrite])
           |> Map.put(:custom_theme_preset, custom_theme_preset) do
      Persist.replace_section(community_dashboard, :layout, args)
    end
  end

  @spec select(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def select(%Community{} = community, %{theme_preset: :custom} = args) do
    with {:ok, dashboard} <- Persist.get_or_insert_dashboard(community) do
      select(dashboard, args)
    end
  end

  @spec select(CommunityDashboard.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def select(%CommunityDashboard{} = community_dashboard, %{theme_preset: :custom} = args) do
    args = Map.drop(args, [:community])

    with current_layout <- current_layout(community_dashboard),
         true <- is_map(current_layout.custom_theme_preset) do
      Persist.replace_section(community_dashboard, :layout, args)
    else
      false -> {:error, "custom theme preset has not been created"}
    end
  end

  @doc "Selects a theme preset on a community or an existing dashboard row."
  def select(%Community{} = community, args) do
    with {:ok, dashboard} <- Persist.get_or_insert_dashboard(community) do
      select(dashboard, args)
    end
  end

  def select(%CommunityDashboard{} = community_dashboard, args) do
    args = Map.drop(args, [:community])
    Persist.replace_section(community_dashboard, :layout, args)
  end

  defp current_layout(community_dashboard) do
    community_dashboard.layout ||
      struct(Layout, Layout.default())
  end

  defp validate_custom_save(%{theme_preset: :custom, theme_preset_base: :custom}) do
    {:error, "saveCustomThemePreset requires a read-only themePresetBase"}
  end

  defp validate_custom_save(%{theme_preset: :custom}), do: {:ok, :pass}

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
      {:ok, ThemePreset.compose_custom_preset(base_preset, overwrite)}
    end
  end

  defp custom_selected?(theme_preset), do: theme_preset in [:custom, "custom", "CUSTOM"]
end
