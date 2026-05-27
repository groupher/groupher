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
  @wallpaper_types ~w(none gradient picture mesh upload)
  @bg_sizes ~w(cover contain auto)
  @texture_types ~w(grain pixelate screentone dither)

  @doc "for test usage"
  def default, do: dsb_default(:wallpaper)

  embedded_schema do
    dsb_fields(:wallpaper)
  end

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)
    |> validate_inclusion(:type, @wallpaper_types)
    |> validate_inclusion(:bg_size, @bg_sizes)
    |> validate_number(:gradient_deg, greater_than_or_equal_to: 0, less_than_or_equal_to: 359)
    |> validate_number(:blur_intensity, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
    |> validate_number(:brightness, greater_than_or_equal_to: 60, less_than_or_equal_to: 140)
    |> validate_number(:saturation, greater_than_or_equal_to: 0, less_than_or_equal_to: 160)
    |> validate_texture()
    |> validate_mesh()
  end

  defp validate_texture(changeset) do
    validate_change(changeset, :texture, fn :texture, value ->
      type = map_get(value, "type")
      intensity = map_get(value, "intensity")
      params = map_get(value, "params")

      cond do
        not is_map(value) ->
          [texture: "must be an object"]

        type not in @texture_types ->
          [texture: "has unsupported type"]

        not is_integer(intensity) or intensity < 0 or intensity > 100 ->
          [texture: "has unsupported intensity"]

        not is_nil(params) and not is_map(params) ->
          [texture: "has unsupported params"]

        true ->
          []
      end
    end)
  end

  defp validate_mesh(changeset) do
    validate_change(changeset, :mesh, fn :mesh, value ->
      cond do
        is_nil(value) ->
          []

        not is_map(value) ->
          [mesh: "must be an object"]

        not valid_mesh?(value) ->
          [mesh: "has unsupported config"]

        true ->
          []
      end
    end)
  end

  defp valid_mesh?(mesh) do
    version = map_get(mesh, "version")
    colors = map_get(mesh, "colors")
    flow = map_get(mesh, "flow")
    softness = map_get(mesh, "softness")
    contrast = map_get(mesh, "contrast")
    brightness = map_get(mesh, "brightness")
    anchors = map_get(mesh, "anchors")

    version == 1 and is_list(colors) and colors != [] and
      number_in_range?(flow, 0, 359) and
      number_in_range?(softness, 0, 100) and
      number_in_range?(contrast, 60, 140) and
      number_in_range?(brightness, 60, 140) and
      is_list(anchors) and Enum.all?(anchors, &valid_mesh_anchor?(&1, length(colors)))
  end

  defp valid_mesh_anchor?(anchor, color_count) when is_map(anchor) do
    x = map_get(anchor, "x")
    y = map_get(anchor, "y")
    color = map_get(anchor, "color")

    number_in_range?(x, 0, 1) and number_in_range?(y, 0, 1) and
      is_integer(color) and color >= 0 and color < color_count
  end

  defp valid_mesh_anchor?(_, _), do: false

  defp number_in_range?(value, min, max) when is_number(value), do: value >= min and value <= max
  defp number_in_range?(_, _, _), do: false

  defp map_get(map, key) when is_map(map),
    do: Map.get(map, key) || Map.get(map, String.to_atom(key))

  defp map_get(_, _), do: nil
end
