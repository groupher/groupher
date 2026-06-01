defmodule GroupherServer.CMS.Model.Embeds.Dashboard.Wallpaper do
  @type t :: %__MODULE__{}

  @moduledoc """
  general article comment meta info
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  import GroupherServerWeb.Schema.Helper.Fields,
    only: [dsb_cast_fields: 1, dsb_default: 1, dsb_fields: 1]

  @optional_fields dsb_cast_fields(:wallpaper)
  @wallpaper_types ~w(none gradient picture upload)
  @bg_sizes ~w(cover contain auto)
  @texture_types ~w(noise tile beam ascii dots oil)
  @gradient_renderer_linear "linear"
  @gradient_renderer_radial "radial"
  @mesh_renderers ~w(flow liquid)
  @radial_shapes ~w(circle ellipse)
  @pattern_ids 1..33 |> Enum.map(&String.pad_leading("#{&1}", 2, "0"))
  @pattern_tones ~w(dark light)

  @doc "for test usage"
  def default, do: dsb_default(:wallpaper)

  embedded_schema do
    dsb_fields(:wallpaper)
  end

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)
    |> validate_inclusion(:type, @wallpaper_types)
    |> validate_inclusion(:type_dark, @wallpaper_types)
    |> validate_inclusion(:bg_size, @bg_sizes)
    |> validate_inclusion(:bg_size_dark, @bg_sizes)
    |> validate_inclusion(:pattern_id, @pattern_ids)
    |> validate_inclusion(:pattern_id_dark, @pattern_ids)
    |> validate_inclusion(:pattern_tone, @pattern_tones)
    |> validate_inclusion(:pattern_tone_dark, @pattern_tones)
    |> validate_number(:pattern_intensity,
      greater_than_or_equal_to: 0,
      less_than_or_equal_to: 100
    )
    |> validate_number(:pattern_intensity_dark,
      greater_than_or_equal_to: 0,
      less_than_or_equal_to: 100
    )
    |> validate_number(:blur_intensity, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
    |> validate_number(:blur_intensity_dark,
      greater_than_or_equal_to: 0,
      less_than_or_equal_to: 100
    )
    |> validate_number(:brightness, greater_than_or_equal_to: 60, less_than_or_equal_to: 140)
    |> validate_number(:brightness_dark, greater_than_or_equal_to: 60, less_than_or_equal_to: 140)
    |> validate_number(:saturation, greater_than_or_equal_to: 0, less_than_or_equal_to: 160)
    |> validate_number(:saturation_dark, greater_than_or_equal_to: 0, less_than_or_equal_to: 160)
    |> validate_texture(:texture)
    |> validate_texture(:texture_dark)
    |> validate_gradient(:gradient)
    |> validate_gradient(:gradient_dark)
  end

  defp validate_texture(changeset, field) do
    validate_change(changeset, field, fn ^field, value ->
      type = map_get(value, "type")
      intensity = map_get(value, "intensity")
      params = map_get(value, "params")

      cond do
        not is_map(value) ->
          [{field, "must be an object"}]

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

  defp number_in_range?(value, min, max) when is_number(value), do: value >= min and value <= max
  defp number_in_range?(_, _, _), do: false

  defp map_get(map, key) when is_map(map),
    do: Map.get(map, key) || Map.get(map, String.to_atom(key))

  defp map_get(_, _), do: nil
end
