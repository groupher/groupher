defmodule GroupherServer.CMS.Helper.ThemePreset do
  @moduledoc """
  Dashboard appearance preset token registry and resolver.

  The dashboard stores a selected `theme_preset` plus a sparse custom overwrite
  map. This module owns the built-in preset defaults and resolves the
  API-facing `theme_tokens` payload. Built-in presets ignore stored overwrites;
  only the custom preset merges:

      preset defaults + custom overwrite

  Keeping this on the backend gives every client the same token source for
  Appearance preset details, including page background, primary/accent colors,
  typography colors, frosted glass opacity, and page glow.
  """

  @token_keys [
    "pageBg",
    "pageBgDark",
    "pageBgHue",
    "pageBgHueDark",
    "pageBgIntensity",
    "pageBgIntensityDark",
    "primaryColor",
    "primaryColorDark",
    "accentColor",
    "accentColorDark",
    "textTitle",
    "textTitleDark",
    "textDigest",
    "textDigestDark",
    "cardColor",
    "cardColorDark",
    "dividerColor",
    "dividerColorDark",
    "gaussBlur",
    "gaussBlurDark",
    "glowType",
    "glowTypeDark",
    "glowFixed",
    "glowOpacity",
    "glowOpacityDark"
  ]
  @preset_keys [:default, :claude, :solarized, :hn]

  @defaults %{
    default: %{
      "pageBg" => "#fffcfc",
      "pageBgDark" => "#25161d",
      "pageBgHue" => 0,
      "pageBgHueDark" => 332,
      "pageBgIntensity" => 0,
      "pageBgIntensityDark" => 6,
      "primaryColor" => "#7d519e",
      "primaryColorDark" => "#9669b9",
      "accentColor" => "#5073c6",
      "accentColorDark" => "#3a7ec7",
      "textTitle" => "#243041",
      "textTitleDark" => "#f5f5f5",
      "textDigest" => "#6b7280",
      "textDigestDark" => "#949494",
      "cardColor" => "#ffffff",
      "cardColorDark" => "#252525",
      "dividerColor" => "#eae9e9",
      "dividerColorDark" => "#353535",
      "gaussBlur" => 100,
      "gaussBlurDark" => 100,
      "glowType" => "",
      "glowTypeDark" => "",
      "glowFixed" => true,
      "glowOpacity" => 100,
      "glowOpacityDark" => 100
    },
    claude: %{
      # "#fefaf1",
      "pageBg" => "#faf9f5",
      "pageBgDark" => "#1e141b",
      "pageBgHue" => 48,
      "pageBgHueDark" => 318,
      "pageBgIntensity" => 32,
      "pageBgIntensityDark" => 0,
      "primaryColor" => "#c96442",
      "primaryColorDark" => "#d97757",
      "accentColor" => "#5073c6",
      "accentColorDark" => "#3a7ec7",
      "textTitle" => "#2f2a24",
      "textTitleDark" => "#f4eee7",
      "textDigest" => "#786f63",
      "textDigestDark" => "#a9a19a",
      "cardColor" => "#fffdf8",
      "cardColorDark" => "#261b22",
      "dividerColor" => "#e6ded2",
      "dividerColorDark" => "#3a3035",
      "gaussBlur" => 100,
      "gaussBlurDark" => 100,
      "glowType" => "",
      "glowTypeDark" => "",
      "glowFixed" => true,
      "glowOpacity" => 100,
      "glowOpacityDark" => 100
    },
    solarized: %{
      "pageBg" => "#fdf7e7",
      "pageBgDark" => "#122732",
      "pageBgHue" => 44,
      "pageBgHueDark" => 201,
      "pageBgIntensity" => 100,
      "pageBgIntensityDark" => 22,
      "primaryColor" => "#859900",
      "primaryColorDark" => "#b6c65b",
      "accentColor" => "#5073c6",
      "accentColorDark" => "#3a7ec7",
      "textTitle" => "#073642",
      "textTitleDark" => "#e8f0ed",
      "textDigest" => "#657b83",
      "textDigestDark" => "#93a1a1",
      "cardColor" => "#fff9e8",
      "cardColorDark" => "#18313d",
      "dividerColor" => "#e2dccb",
      "dividerColorDark" => "#2f4c57",
      "gaussBlur" => 100,
      "gaussBlurDark" => 100,
      "glowType" => "",
      "glowTypeDark" => "",
      "glowFixed" => true,
      "glowOpacity" => 100,
      "glowOpacityDark" => 100
    },
    hn: %{
      "pageBg" => "#fefef0",
      "pageBgDark" => "#1e1c1b",
      "pageBgHue" => 60,
      "pageBgHueDark" => 20,
      "pageBgIntensity" => 54,
      "pageBgIntensityDark" => 1,
      "primaryColor" => "#333333",
      "primaryColorDark" => "#333333",
      "accentColor" => "#5073c6",
      "accentColorDark" => "#3a7ec7",
      "textTitle" => "#222222",
      "textTitleDark" => "#e6e6e6",
      "textDigest" => "#666666",
      "textDigestDark" => "#9a9a9a",
      "cardColor" => "#fffff5",
      "cardColorDark" => "#292625",
      "dividerColor" => "#e6e6d6",
      "dividerColorDark" => "#3c3938",
      "gaussBlur" => 100,
      "gaussBlurDark" => 100,
      "glowType" => "",
      "glowTypeDark" => "",
      "glowFixed" => true,
      "glowOpacity" => 100,
      "glowOpacityDark" => 100
    }
  }

  def token_keys, do: @token_keys
  def preset_keys, do: @preset_keys

  def options do
    Enum.map(preset_keys(), fn preset ->
      %{
        value: preset,
        tokens: defaults(preset)
      }
    end)
  end

  def defaults(preset) do
    Map.get(@defaults, normalize_preset(preset), @defaults.default)
  end

  def resolve(preset, overwrite) do
    normalized_preset = normalize_preset(preset)

    normalized_preset
    |> defaults()
    |> maybe_merge_custom_overwrite(normalized_preset, overwrite)
  end

  def resolve_custom(base_preset, overwrite) do
    base_preset
    |> defaults()
    |> Map.merge(normalize_overwrite(overwrite))
  end

  defp maybe_merge_custom_overwrite(defaults, :custom, overwrite),
    do: Map.merge(defaults, normalize_overwrite(overwrite))

  defp maybe_merge_custom_overwrite(defaults, _preset, _overwrite), do: defaults

  def normalize_overwrite(overwrite) when is_map(overwrite) do
    overwrite
    |> Enum.reduce(%{}, fn {key, value}, acc ->
      normalized_key =
        key
        |> normalize_key()

      if normalized_key in @token_keys do
        Map.put(acc, normalized_key, normalize_value(value))
      else
        acc
      end
    end)
  end

  def normalize_overwrite(_), do: %{}

  defp normalize_preset(preset) when is_binary(preset) do
    preset
    |> String.downcase()
    |> String.to_existing_atom()
  rescue
    ArgumentError -> :default
  end

  defp normalize_preset(preset) when is_atom(preset), do: preset
  defp normalize_preset(_), do: :default

  defp normalize_key(key) when is_atom(key), do: key |> Atom.to_string() |> camelize_key()
  defp normalize_key(key) when is_binary(key), do: camelize_key(key)
  defp normalize_key(key), do: to_string(key)

  defp camelize_key(""), do: ""

  defp camelize_key(key) do
    key
    |> Macro.camelize()
    |> then(fn <<first::binary-size(1), rest::binary>> -> String.downcase(first) <> rest end)
  end

  defp normalize_value(value) when is_boolean(value), do: value
  defp normalize_value(value) when is_atom(value), do: Atom.to_string(value)
  defp normalize_value(value), do: value
end
