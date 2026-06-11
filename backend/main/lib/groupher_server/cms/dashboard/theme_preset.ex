defmodule GroupherServer.CMS.Dashboard.ThemePreset do
  @moduledoc """
  Dashboard appearance preset token registry and resolver.

  The dashboard stores a selected `theme_preset` plus a nullable
  `custom_theme_preset` definition. This module owns the built-in preset
  defaults and resolves the API-facing `theme_tokens` payload. Built-in presets
  are readonly; Custom merges:

      base preset defaults + custom overwrite

  Theme-aware appearance data follows the same boundary used by other
  light/dark editor data:

    * `light` / `dark` contain values that can differ by theme.
    * `shared` contains business configuration that applies to both themes.
    * `meta` is reserved for resource/document metadata, such as cover canvas
      dimensions. ThemePreset currently has no metadata, so it does not emit an
      empty `meta` object.

  Keeping this on the backend gives every client the same token source for
  Appearance preset details, including page background, primary/accent colors,
  typography colors, frosted glass opacity, and page glow.
  """

  @preset_keys [:default, :claude, :solarized, :hn]
  @theme_sections ["light", "dark"]

  @defaults %{
    default: %{
      "shared" => %{
        "glowFixed" => true
      },
      "light" => %{
        "pageBg" => "#fffcfc",
        "pageBgHue" => 0,
        "pageBgIntensity" => 0,
        "primaryColor" => "#7d519e",
        "accentColor" => "#5073c6",
        "textTitle" => "#243041",
        "textDigest" => "#6b7280",
        "cardColor" => "#ffffff",
        "dividerColor" => "#eae9e9",
        "gaussBlur" => 100,
        "glowType" => "",
        "glowOpacity" => 100
      },
      "dark" => %{
        "pageBg" => "#25161d",
        "pageBgHue" => 332,
        "pageBgIntensity" => 6,
        "primaryColor" => "#9669b9",
        "accentColor" => "#3a7ec7",
        "textTitle" => "#f5f5f5",
        "textDigest" => "#949494",
        "cardColor" => "#252525",
        "dividerColor" => "#353535",
        "gaussBlur" => 100,
        "glowType" => "",
        "glowOpacity" => 100
      }
    },
    claude: %{
      "shared" => %{
        "glowFixed" => true
      },
      "light" => %{
        "pageBg" => "#faf9f5",
        "pageBgHue" => 48,
        "pageBgIntensity" => 32,
        "primaryColor" => "#c96442",
        "accentColor" => "#5073c6",
        "textTitle" => "#2f2a24",
        "textDigest" => "#786f63",
        "cardColor" => "#fffdf8",
        "dividerColor" => "#e6ded2",
        "gaussBlur" => 100,
        "glowType" => "",
        "glowOpacity" => 100
      },
      "dark" => %{
        "pageBg" => "#1e141b",
        "pageBgHue" => 318,
        "pageBgIntensity" => 0,
        "primaryColor" => "#d97757",
        "accentColor" => "#3a7ec7",
        "textTitle" => "#f4eee7",
        "textDigest" => "#a9a19a",
        "cardColor" => "#261b22",
        "dividerColor" => "#3a3035",
        "gaussBlur" => 100,
        "glowType" => "",
        "glowOpacity" => 100
      }
    },
    solarized: %{
      "shared" => %{
        "glowFixed" => true
      },
      "light" => %{
        "pageBg" => "#fdf7e7",
        "pageBgHue" => 44,
        "pageBgIntensity" => 100,
        "primaryColor" => "#859900",
        "accentColor" => "#5073c6",
        "textTitle" => "#073642",
        "textDigest" => "#657b83",
        "cardColor" => "#fff9e8",
        "dividerColor" => "#e2dccb",
        "gaussBlur" => 100,
        "glowType" => "",
        "glowOpacity" => 100
      },
      "dark" => %{
        "pageBg" => "#122732",
        "pageBgHue" => 201,
        "pageBgIntensity" => 22,
        "primaryColor" => "#b6c65b",
        "accentColor" => "#3a7ec7",
        "textTitle" => "#e8f0ed",
        "textDigest" => "#93a1a1",
        "cardColor" => "#18313d",
        "dividerColor" => "#2f4c57",
        "gaussBlur" => 100,
        "glowType" => "",
        "glowOpacity" => 100
      }
    },
    hn: %{
      "shared" => %{
        "glowFixed" => true
      },
      "light" => %{
        "pageBg" => "#fefef0",
        "pageBgHue" => 60,
        "pageBgIntensity" => 54,
        "primaryColor" => "#333333",
        "accentColor" => "#5073c6",
        "textTitle" => "#222222",
        "textDigest" => "#666666",
        "cardColor" => "#fffff5",
        "dividerColor" => "#e6e6d6",
        "gaussBlur" => 100,
        "glowType" => "",
        "glowOpacity" => 100
      },
      "dark" => %{
        "pageBg" => "#1e1c1b",
        "pageBgHue" => 20,
        "pageBgIntensity" => 1,
        "primaryColor" => "#333333",
        "accentColor" => "#3a7ec7",
        "textTitle" => "#e6e6e6",
        "textDigest" => "#9a9a9a",
        "cardColor" => "#292625",
        "dividerColor" => "#3c3938",
        "gaussBlur" => 100,
        "glowType" => "",
        "glowOpacity" => 100
      }
    }
  }

  @shared_token_keys @defaults.default["shared"] |> Map.keys() |> MapSet.new()
  @theme_token_keys @defaults.default["light"] |> Map.keys() |> MapSet.new()
  @color_token_keys MapSet.new([
                      "pageBg",
                      "primaryColor",
                      "accentColor",
                      "textTitle",
                      "textDigest",
                      "cardColor",
                      "dividerColor"
                    ])
  @hue_token_keys MapSet.new(["pageBgHue"])
  @percent_token_keys MapSet.new(["pageBgIntensity", "gaussBlur", "glowOpacity"])

  def token_keys do
    %{
      "shared" => MapSet.to_list(@shared_token_keys),
      "light" => MapSet.to_list(@theme_token_keys),
      "dark" => MapSet.to_list(@theme_token_keys)
    }
  end

  def preset_keys, do: @preset_keys

  @doc """
  Return all resolved tokens for a readonly theme preset.

  Problem scenario: clients need a complete renderable token map for a preset,
  but the database only stores the selected preset name and sparse Custom
  overwrite fields.

  Example:

      ThemePreset.tokens(:claude)["light"]["cardColor"]
      #=> "#fffdf8"

  """
  def tokens(preset), do: defaults(preset)

  @doc """
  Return preset options available to one dashboard.

  Problem scenario: built-in presets are global, but Custom is a community
  preset and should appear only after the user creates it. An empty Custom
  overwrite still means "created"; it resolves to the selected base preset.

  Example:

      ThemePreset.options(%{"basePreset" => "claude", "overwrite" => %{}})
      #=> [%{value: :default, ...}, ..., %{value: :custom, tokens: claude_tokens}]

  """
  def options(custom_preset \\ nil) do
    options =
      Enum.map(preset_keys(), fn preset ->
        %{
          value: preset,
          tokens: tokens(preset)
        }
      end)

    case custom_option(custom_preset) do
      nil -> options
      custom -> options ++ [custom]
    end
  end

  @doc false
  def defaults(preset) do
    Map.get(@defaults, normalize_preset(preset), @defaults.default)
  end

  @doc """
  Resolve the API-facing `themeTokens` map for a selected preset.

  Problem scenario: GraphQL should return full tokens for rendering. Readonly
  presets resolve directly from preset defaults; Custom resolves from its stored
  `{basePreset, overwrite}` definition.

  Example:

      ThemePreset.resolve(:custom, %{"basePreset" => "claude", "overwrite" => %{"light" => %{"cardColor" => "#ffffff"}}})
      #=> %{"shared" => ..., "light" => %{"cardColor" => "#ffffff", ...}, "dark" => ...}

  """
  def resolve(:custom, custom_preset), do: resolve_custom_preset(custom_preset)
  def resolve("custom", custom_preset), do: resolve_custom_preset(custom_preset)
  def resolve(preset, _custom_preset), do: tokens(preset)

  @doc """
  Resolve Custom tokens from a readonly base preset and sparse overwrite.

  Problem scenario: the editor stores only fields that differ from the base, but
  the page renderer needs a complete token map.

  Example:

      ThemePreset.resolve_custom(:claude, %{"light" => %{"cardColor" => "#ffffff"}})["light"]["pageBg"]
      #=> "#faf9f5"

  """
  def resolve_custom(base_preset, overwrite) do
    deep_merge(tokens(base_preset), overwrite || %{})
  end

  @doc """
  Build a stored Custom preset definition.

  Problem scenario: Custom creation must stay enabled even when its overwrite is
  empty after reset. The nullable Custom preset map is the source of existence;
  `overwrite` only stores fields that differ from the base.

  Example:

      ThemePreset.build_custom_preset(:claude, %{})
      #=> %{"basePreset" => "claude", "overwrite" => %{}}

  """
  def build_custom_preset(base_preset, overwrite) do
    %{
      "basePreset" => normalize_preset(base_preset) |> Atom.to_string(),
      "overwrite" => prune_empty_sections(overwrite || %{})
    }
  end

  @doc """
  Return the readonly base preset key stored inside a Custom preset.

  Example:

      ThemePreset.custom_base_preset(%{"basePreset" => "claude"})
      #=> :claude

  """
  def custom_base_preset(custom_preset) when is_map(custom_preset) do
    custom_preset
    |> Map.get("basePreset", Map.get(custom_preset, :basePreset))
    |> normalize_preset()
  end

  def custom_base_preset(_), do: :default

  @doc """
  Return the sparse overwrite stored inside a Custom preset.

  Example:

      ThemePreset.custom_overwrite(%{"overwrite" => %{"light" => %{"primaryColor" => "#112233"}}})
      #=> %{"light" => %{"primaryColor" => "#112233"}}

  """
  def custom_overwrite(custom_preset) when is_map(custom_preset) do
    Map.get(custom_preset, "overwrite", Map.get(custom_preset, :overwrite, %{})) || %{}
  end

  def custom_overwrite(_), do: %{}

  @doc """
  Resolve stored Custom preset definition into complete render tokens.

  Example:

      ThemePreset.resolve_custom_preset(%{"basePreset" => "claude", "overwrite" => %{}})
      #=> ThemePreset.tokens(:claude)

  """
  def resolve_custom_preset(custom_preset) when is_map(custom_preset) do
    resolve_custom(custom_base_preset(custom_preset), custom_overwrite(custom_preset))
  end

  def resolve_custom_preset(_), do: tokens(:default)

  @doc """
  Validate a stored Custom preset definition.

  Problem scenario: `custom_theme_preset` means Custom was created. Therefore
  `nil` is valid for "not created", and `%{"basePreset" => ..., "overwrite" =>
  %{}}` is valid for "created but currently equal to base".

  Example:

      ThemePreset.validate_custom_preset(%{"basePreset" => "claude", "overwrite" => %{}})
      #=> :ok

  """
  def validate_custom_preset(nil), do: :ok

  def validate_custom_preset(custom_preset) when is_map(custom_preset) do
    with :ok <- validate_custom_preset_shape(custom_preset),
         {:ok, base_preset} <- validate_custom_base_preset(custom_preset["basePreset"]),
         true <- base_preset != :custom,
         {:ok, _} <- validate_overwrite(custom_preset["overwrite"]) do
      :ok
    else
      false -> {:error, "requires a read-only base preset"}
      {:error, {:custom, reason}} -> {:error, reason}
      {:error, reason} -> {:error, reason}
    end
  end

  def validate_custom_preset(_), do: {:error, "must be a map"}

  defp validate_custom_preset_shape(custom_preset) do
    required_keys = MapSet.new(["basePreset", "overwrite"])
    keys = custom_preset |> Map.keys() |> MapSet.new()

    cond do
      keys != required_keys ->
        {:error, "requires basePreset and overwrite"}

      not is_binary(custom_preset["basePreset"]) ->
        {:error, "basePreset must be a string"}

      not is_map(custom_preset["overwrite"]) ->
        {:error, "overwrite must be a map"}

      true ->
        :ok
    end
  end

  defp validate_custom_base_preset(base_preset) do
    with {:ok, preset} <- parse_known_preset(base_preset) do
      {:ok, preset}
    end
  end

  defp parse_known_preset(base_preset) when is_binary(base_preset) do
    preset =
      base_preset
      |> String.downcase()
      |> String.to_existing_atom()

    if preset in @preset_keys or preset == :custom do
      {:ok, preset}
    else
      {:error, "invalid basePreset"}
    end
  rescue
    ArgumentError -> {:error, "invalid basePreset"}
  end

  defp parse_known_preset(_), do: {:error, "invalid basePreset"}

  @doc """
  Validate a sparse Custom overwrite payload.

  Problem scenario: `saveCustomThemePreset` accepts JSON, so the backend must
  reject unknown token keys and wrong values before anything is persisted. This
  payload is only persisted when the target preset is Custom; readonly presets
  are selected by name and never store overwrite data. The function does not
  camelize keys, silently drop fields, or fill defaults.

  Validation intentionally stays simple and explicit: color tokens accept hex
  colors, hue accepts 0..360, and percent sliders accept 0..100. The backend is
  the source of truth for saved custom theme input, so invalid CSS/color strings
  should not be stored for the frontend to interpret later.

  Example:

      ThemePreset.validate_overwrite(%{"light" => %{"gaussBlur" => 72}})
      #=> {:ok, %{"light" => %{"gaussBlur" => 72}}}

      ThemePreset.validate_overwrite(%{"light" => %{"gaussBlur" => "bad"}})
      #=> {:error, {:custom, "invalid theme overwrite value: light.gaussBlur"}}

  """
  def validate_overwrite(overwrite) when is_map(overwrite) do
    overwrite
    |> Enum.reduce_while({:ok, %{}}, fn {section, section_overwrite}, {:ok, acc} ->
      cond do
        not is_binary(section) ->
          {:halt, invalid_key(section)}

        section == "shared" ->
          validate_section(section, section_overwrite, @shared_token_keys, acc)

        section in @theme_sections ->
          validate_section(section, section_overwrite, @theme_token_keys, acc)

        true ->
          {:halt, invalid_key(section)}
      end
    end)
    |> case do
      {:ok, normalized} -> {:ok, prune_empty_sections(normalized)}
      error -> error
    end
  end

  def validate_overwrite(_), do: {:error, {:custom, "theme overwrite must be a map"}}

  @doc """
  Merge incoming Custom overwrite into the existing saved overwrite.

  Problem scenario: the frontend submits only the sparse overwrite changed by
  the current save. Existing Custom edits must be preserved, and fields equal to
  the base preset token should be removed so Custom overwrite means "different
  from base".

  Example:

      ThemePreset.merge_overwrite(:claude, %{"light" => %{"cardColor" => "#ffffff"}}, %{"light" => %{"cardColor" => "#fffdf8"}})
      #=> {:ok, %{}}

  """
  def merge_overwrite(base_preset, existing_overwrite, incoming_overwrite) do
    base_tokens = tokens(base_preset)

    with {:ok, existing} <- validate_overwrite(existing_overwrite || %{}),
         {:ok, incoming} <- validate_overwrite(incoming_overwrite || %{}) do
      overwrite =
        existing
        |> deep_merge(incoming)
        |> strip_base_equal_values(base_tokens)
        |> prune_empty_sections()

      {:ok, overwrite}
    end
  end

  defp custom_option(custom_preset) when is_map(custom_preset) do
    %{
      value: :custom,
      tokens: resolve_custom_preset(custom_preset)
    }
  end

  defp custom_option(_), do: nil

  defp normalize_preset(preset) when is_binary(preset) do
    preset
    |> String.downcase()
    |> String.to_existing_atom()
  rescue
    ArgumentError -> :default
  end

  defp normalize_preset(preset) when is_atom(preset), do: preset
  defp normalize_preset(_), do: :default

  defp validate_section(_section, section_overwrite, _allowed_keys, _acc)
       when not is_map(section_overwrite),
       do: {:halt, {:error, {:custom, "theme overwrite section must be a map"}}}

  defp validate_section(section, section_overwrite, allowed_keys, acc) do
    section_overwrite
    |> Enum.reduce_while({:ok, %{}}, fn {key, value}, {:ok, section_acc} ->
      cond do
        not is_binary(key) ->
          {:halt, invalid_key("#{section}.#{inspect(key)}")}

        not MapSet.member?(allowed_keys, key) ->
          {:halt, invalid_key("#{section}.#{key}")}

        not valid_token_value?(section, key, value) ->
          {:halt, invalid_value("#{section}.#{key}")}

        true ->
          {:cont, {:ok, Map.put(section_acc, key, value)}}
      end
    end)
    |> case do
      {:ok, normalized_section} -> {:cont, {:ok, Map.put(acc, section, normalized_section)}}
      error -> {:halt, error}
    end
  end

  defp valid_token_value?("shared", "glowFixed", value), do: is_boolean(value)

  defp valid_token_value?(section, key, value) when section in @theme_sections do
    cond do
      is_binary(value) and MapSet.member?(@color_token_keys, key) -> valid_hex_color?(value)
      is_binary(value) and key == "glowType" -> true
      is_number(value) and MapSet.member?(@hue_token_keys, key) -> value >= 0 and value <= 360
      is_number(value) and MapSet.member?(@percent_token_keys, key) -> value >= 0 and value <= 100
      true -> false
    end
  end

  defp valid_token_value?(_, _, _), do: false

  defp deep_merge(left, right) when is_map(left) and is_map(right) do
    Map.merge(left, right, fn _key, left_value, right_value ->
      deep_merge(left_value, right_value)
    end)
  end

  defp deep_merge(_left, right), do: right

  defp strip_base_equal_values(overwrite, base_tokens) do
    Enum.reduce(overwrite, %{}, fn {section, section_overwrite}, acc ->
      base_section = Map.get(base_tokens, section, %{})

      cleaned_section =
        section_overwrite
        |> Enum.reject(fn {key, value} -> Map.get(base_section, key) == value end)
        |> Map.new()

      Map.put(acc, section, cleaned_section)
    end)
  end

  defp prune_empty_sections(overwrite) do
    overwrite
    |> Enum.reject(fn {_section, section_overwrite} -> section_overwrite == %{} end)
    |> Map.new()
  end

  defp valid_hex_color?(value), do: Regex.match?(~r/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, value)

  defp invalid_key(key), do: {:error, {:custom, "invalid theme overwrite key: #{inspect(key)}"}}
  defp invalid_value(key), do: {:error, {:custom, "invalid theme overwrite value: #{key}"}}
end
