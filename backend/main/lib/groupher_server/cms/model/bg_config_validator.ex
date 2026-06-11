defmodule GroupherServer.CMS.Model.BgConfigValidator do
  @moduledoc """
  Shared validator for nested dashboard background config.

  Dashboard wallpaper embeds and cover background rows both use
  `Dashboard.Fields.macro_schema(:wallpaper_bg)`. Keep structural validation here
  so `pattern`, `effect`, `texture.enabled`, and `gradient` do not drift between
  those two persistence paths.

  ## Example

      attrs = %{
        pattern: %{"enabled" => true, "id" => "01", "intensity" => 50, "tone" => "dark"},
        effect: %{"blurIntensity" => 0, "brightness" => 100, "saturation" => 100},
        texture: %{"enabled" => false, "type" => "noise", "intensity" => 0, "params" => %{}}
      }

      struct |> cast(attrs, fields) |> BgConfigValidator.validate()

  """

  import Ecto.Changeset

  @wallpaper_types ~w(none gradient picture upload)
  @texture_types ~w(noise tile beam ascii dots oil)
  @gradient_renderer_linear "linear"
  @gradient_renderer_radial "radial"
  @mesh_renderers ~w(flow liquid)
  @radial_shapes ~w(circle ellipse)
  @pattern_ids 1..33 |> Enum.map(&String.pad_leading("#{&1}", 2, "0"))
  @pattern_tones ~w(dark light)

  def validate(changeset) do
    changeset
    |> validate_inclusion(:type, @wallpaper_types)
    |> validate_pattern(:pattern)
    |> validate_content_shadow(:content_shadow)
    |> validate_effect(:effect)
    |> validate_texture(:texture)
    |> validate_gradient(:gradient)
  end

  defp validate_pattern(changeset, field) do
    validate_change(changeset, field, fn ^field, value ->
      enabled = map_get(value, "enabled")
      id = map_get(value, "id")
      intensity = map_get(value, "intensity")
      tone = map_get(value, "tone")

      cond do
        not is_map(value) ->
          [{field, "must be an object"}]

        not is_boolean(enabled) ->
          [{field, "has unsupported enabled"}]

        id not in @pattern_ids ->
          [{field, "has unsupported id"}]

        not is_integer(intensity) or intensity < 0 or intensity > 100 ->
          [{field, "has unsupported intensity"}]

        tone not in @pattern_tones ->
          [{field, "has unsupported tone"}]

        true ->
          []
      end
    end)
  end

  defp validate_content_shadow(changeset, field) do
    validate_change(changeset, field, fn ^field, value ->
      enabled = map_get(value, "enabled")

      cond do
        not is_map(value) ->
          [{field, "must be an object"}]

        not is_boolean(enabled) ->
          [{field, "has unsupported enabled"}]

        true ->
          []
      end
    end)
  end

  defp validate_effect(changeset, field) do
    validate_change(changeset, field, fn ^field, value ->
      blur_intensity = map_get(value, "blurIntensity")
      brightness = map_get(value, "brightness")
      saturation = map_get(value, "saturation")

      cond do
        not is_map(value) ->
          [{field, "must be an object"}]

        not is_integer(blur_intensity) or blur_intensity < 0 or blur_intensity > 100 ->
          [{field, "has unsupported blur intensity"}]

        not is_integer(brightness) or brightness < 60 or brightness > 140 ->
          [{field, "has unsupported brightness"}]

        not is_integer(saturation) or saturation < 0 or saturation > 160 ->
          [{field, "has unsupported saturation"}]

        true ->
          []
      end
    end)
  end

  defp validate_texture(changeset, field) do
    validate_change(changeset, field, fn ^field, value ->
      enabled = map_get(value, "enabled")
      type = map_get(value, "type")
      intensity = map_get(value, "intensity")
      params = map_get(value, "params")

      cond do
        not is_map(value) ->
          [{field, "must be an object"}]

        not is_boolean(enabled) ->
          [{field, "has unsupported enabled"}]

        type not in @texture_types ->
          [{field, "has unsupported type"}]

        not is_integer(intensity) or intensity < 0 or intensity > 100 ->
          [{field, "has unsupported intensity"}]

        not is_nil(params) and not is_map(params) ->
          [{field, "has unsupported params"}]

        true ->
          []
      end
    end)
  end

  defp validate_gradient(changeset, field) do
    validate_change(changeset, field, fn ^field, value ->
      cond do
        is_nil(value) ->
          []

        not is_map(value) ->
          [{field, "must be an object"}]

        not valid_gradient?(value) ->
          [{field, "has unsupported config"}]

        true ->
          []
      end
    end)
  end

  defp valid_gradient?(gradient) do
    renderer = map_get(gradient, "renderer")

    cond do
      renderer == @gradient_renderer_linear -> valid_linear_gradient?(gradient)
      renderer == @gradient_renderer_radial -> valid_radial_gradient?(gradient)
      renderer in @mesh_renderers -> valid_mesh?(gradient)
      true -> false
    end
  end

  defp valid_linear_gradient?(gradient) do
    version = map_get(gradient, "version")
    colors = map_get(gradient, "colors")
    angle = map_get(gradient, "angle")
    spread = map_get(gradient, "spread")

    version == 2 and valid_colors?(colors) and number_in_range?(angle, 0, 359) and
      number_in_range?(spread, 0, 100)
  end

  defp valid_radial_gradient?(gradient) do
    version = map_get(gradient, "version")
    colors = map_get(gradient, "colors")
    angle = map_get(gradient, "angle")
    center = map_get(gradient, "center")
    radius = map_get(gradient, "radius")
    shape = map_get(gradient, "shape")
    spread = map_get(gradient, "spread")

    version == 2 and valid_colors?(colors) and optional_number_in_range?(angle, 0, 359) and
      is_map(center) and
      number_in_range?(map_get(center, "x"), 0, 1) and
      number_in_range?(map_get(center, "y"), 0, 1) and
      number_in_range?(radius, 1, 100) and shape in @radial_shapes and
      number_in_range?(spread, 0, 100)
  end

  defp valid_mesh?(mesh) do
    version = map_get(mesh, "version")
    renderer = map_get(mesh, "renderer")
    colors = map_get(mesh, "colors")
    angle = map_get(mesh, "angle")
    softness = map_get(mesh, "softness")
    warp = map_get(mesh, "warp")
    scale = map_get(mesh, "scale")
    contrast = map_get(mesh, "contrast")
    brightness = map_get(mesh, "brightness")

    version == 2 and renderer in @mesh_renderers and valid_colors?(colors) and
      number_in_range?(angle, 0, 359) and
      number_in_range?(softness, 0, 100) and
      number_in_range?(warp, 0, 100) and
      number_in_range?(scale, 0, 100) and
      number_in_range?(contrast, 60, 140) and
      number_in_range?(brightness, 60, 140)
  end

  defp valid_colors?(colors), do: is_list(colors) and colors != []

  defp optional_number_in_range?(nil, _min, _max), do: true
  defp optional_number_in_range?(value, min, max), do: number_in_range?(value, min, max)

  defp number_in_range?(value, min, max) when is_number(value),
    do: value >= min and value <= max

  defp number_in_range?(_, _, _), do: false

  defp map_get(map, key) when is_map(map) do
    case Map.get(map, key) do
      nil ->
        try do
          Map.get(map, String.to_existing_atom(key))
        rescue
          ArgumentError -> nil
        end

      value ->
        value
    end
  end

  defp map_get(_, _), do: nil
end
