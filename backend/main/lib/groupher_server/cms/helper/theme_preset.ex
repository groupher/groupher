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
    "pageCustomBg",
    "pageCustomBgDark",
    "pageCustomIntensity",
    "pageCustomIntensityDark",
    "primaryColor",
    "primaryCustomColor",
    "primaryCustomColorDark",
    "accentColor",
    "accentCustomColor",
    "accentCustomColorDark",
    "textTitle",
    "textDigest",
    "gaussBlur",
    "gaussBlurDark",
    "glowType",
    "glowTypeDark",
    "glowFixed",
    "glowOpacity",
    "glowOpacityDark"
  ]

  @defaults %{
    default: %{
      "pageBg" => "CUSTOM",
      "pageBgDark" => "CUSTOM",
      "pageCustomBg" => 0,
      "pageCustomBgDark" => 0,
      "pageCustomIntensity" => 0,
      "pageCustomIntensityDark" => 15,
      "primaryColor" => "PURPLE",
      "primaryCustomColor" => "",
      "primaryCustomColorDark" => "",
      "accentColor" => "BLUE",
      "accentCustomColor" => "",
      "accentCustomColorDark" => "",
      "textTitle" => "#243041",
      "textDigest" => "#6b7280",
      "gaussBlur" => 100,
      "gaussBlurDark" => 100,
      "glowType" => "",
      "glowTypeDark" => "",
      "glowFixed" => true,
      "glowOpacity" => 100,
      "glowOpacityDark" => 100
    },
    claude: %{
      "pageBg" => "CUSTOM",
      "pageBgDark" => "CUSTOM",
      "pageCustomBg" => 40,
      "pageCustomBgDark" => 0,
      "pageCustomIntensity" => 49,
      "pageCustomIntensityDark" => 0,
      "primaryColor" => "CUSTOM",
      "primaryCustomColor" => "#c96442",
      "primaryCustomColorDark" => "#d97757",
      "accentColor" => "BLUE",
      "accentCustomColor" => "",
      "accentCustomColorDark" => "",
      "textTitle" => "#2f2a24",
      "textDigest" => "#786f63",
      "gaussBlur" => 100,
      "gaussBlurDark" => 100,
      "glowType" => "",
      "glowTypeDark" => "",
      "glowFixed" => true,
      "glowOpacity" => 100,
      "glowOpacityDark" => 100
    },
    solarized: %{
      "pageBg" => "CUSTOM",
      "pageBgDark" => "CUSTOM",
      "pageCustomBg" => 42,
      "pageCustomBgDark" => 191,
      "pageCustomIntensity" => 97,
      "pageCustomIntensityDark" => 18,
      "primaryColor" => "CUSTOM",
      "primaryCustomColor" => "#859900",
      "primaryCustomColorDark" => "#b6c65b",
      "accentColor" => "BLUE",
      "accentCustomColor" => "",
      "accentCustomColorDark" => "",
      "textTitle" => "#073642",
      "textDigest" => "#657b83",
      "gaussBlur" => 100,
      "gaussBlurDark" => 100,
      "glowType" => "",
      "glowTypeDark" => "",
      "glowFixed" => true,
      "glowOpacity" => 100,
      "glowOpacityDark" => 100
    },
    hn: %{
      "pageBg" => "CUSTOM",
      "pageBgDark" => "CUSTOM",
      "pageCustomBg" => 60,
      "pageCustomBgDark" => 38,
      "pageCustomIntensity" => 54,
      "pageCustomIntensityDark" => 0,
      "primaryColor" => "BLACK",
      "primaryCustomColor" => "",
      "primaryCustomColorDark" => "",
      "accentColor" => "BLUE",
      "accentCustomColor" => "",
      "accentCustomColorDark" => "",
      "textTitle" => "#222222",
      "textDigest" => "#666666",
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

  def defaults(preset) do
    Map.get(@defaults, normalize_preset(preset), @defaults.default)
  end

  def resolve(preset, overwrite) do
    normalized_preset = normalize_preset(preset)

    normalized_preset
    |> defaults()
    |> maybe_merge_custom_overwrite(normalized_preset, overwrite)
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

  def normalize_overwrite(overwrite) when is_binary(overwrite) do
    case Jason.decode(overwrite) do
      {:ok, decoded} -> normalize_overwrite(decoded)
      _ -> %{}
    end
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
