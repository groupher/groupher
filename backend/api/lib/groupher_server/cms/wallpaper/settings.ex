defmodule GroupherServer.CMS.Wallpaper.Settings do
  @moduledoc """
  Canonical boundary for one theme's Wallpaper settings.

  GraphQL maps the stable envelope fields. The nested render configuration and
  custom preset config remain JSON, but only this module may normalize them or
  pass them to the Wallpaper domain.

  GraphQL settings envelope -> normalize and validate -> canonical Snapshot
  settings and renderConfig.
  """

  alias GroupherServer.CMS

  alias CMS.Wallpaper.ErrorCat

  @version 1
  @render_config_keys ~w(pattern gradient texture effect)
  @linear_recipe_required ~w(version renderer preset colors angle spread)
  @linear_recipe_optional ~w(stops)
  @radial_recipe_required ~w(version renderer preset colors center radius shape spread)
  @radial_recipe_optional ~w(angle stops)
  @mesh_recipe_required ~w(version renderer preset seed colors angle softness warp scale contrast brightness)
  @type canonical :: map()

  @spec version() :: pos_integer()
  def version, do: @version

  @spec normalize(term()) :: {:ok, canonical()} | {:error, term()}
  def normalize(input) when is_map(input) do
    version = get(input, :settings_schema_version)
    type = normalize_type(get(input, :type))

    cond do
      version != @version -> {:error, ErrorCat.wallpaper_settings_invalid()}
      type == nil -> {:error, ErrorCat.wallpaper_settings_invalid()}
      type == :none -> normalize_none(input, version)
      true -> normalize_renderable(input, version, type)
    end
  end

  def normalize(_input), do: {:error, ErrorCat.wallpaper_settings_invalid()}

  @spec to_graphql(canonical()) :: map()
  def to_graphql(%{"type" => "none", "settingsSchemaVersion" => version}) do
    %{
      settings_schema_version: version,
      type: :none,
      source: nil,
      custom_wallpaper: nil,
      render_config: nil
    }
  end

  def to_graphql(settings) when is_map(settings) do
    %{
      settings_schema_version: settings["settingsSchemaVersion"],
      type: String.to_existing_atom(settings["type"]),
      source: settings["source"],
      custom_wallpaper: graphql_custom_wallpaper(settings["customWallpaper"]),
      render_config: settings["renderConfig"]
    }
  end

  @spec to_graphql(canonical(), integer()) :: map()
  def to_graphql(settings, schema_version) when is_map(settings) and is_integer(schema_version) do
    assert_persisted_version!(settings, schema_version)
    graphql_settings = to_graphql(settings)

    case normalize(graphql_settings) do
      {:ok, _canonical} -> graphql_settings
      {:error, _reason} -> raise ArgumentError, "WALLPAPER_SETTINGS_UNSUPPORTED_SHAPE"
    end
  end

  @doc "Asserts that the Snapshot JSON version and its mirrored database column agree."
  @spec assert_persisted_version!(canonical(), integer()) :: :ok
  def assert_persisted_version!(%{"settingsSchemaVersion" => version}, version)
      when is_integer(version) and version == @version do
    :ok
  end

  def assert_persisted_version!(settings, schema_version) do
    raise ArgumentError,
          "WALLPAPER_SETTINGS_VERSION_MISMATCH: envelope=#{inspect(get(settings, :settings_schema_version) || get(settings, :settingsSchemaVersion))}, column=#{inspect(schema_version)}"
  end

  @doc "Asserts that incoming settings use the current supported schema version."
  @spec assert_current_version!(canonical()) :: :ok
  def assert_current_version!(%{"settingsSchemaVersion" => version})
      when is_integer(version) and version == @version do
    :ok
  end

  def assert_current_version!(settings) do
    raise ArgumentError,
          "WALLPAPER_SETTINGS_VERSION_UNSUPPORTED: #{inspect(get(settings, :settings_schema_version) || get(settings, :settingsSchemaVersion))}"
  end

  @spec default(map()) :: {:ok, canonical()} | {:error, term()}
  def default(theme_settings) when is_map(theme_settings) do
    normalize(%{
      settings_schema_version: @version,
      type: get(theme_settings, :type),
      source: get(theme_settings, :source),
      custom_wallpaper: get(theme_settings, :custom_wallpaper),
      render_config: %{
        "pattern" => get(theme_settings, :pattern),
        "gradient" => get(theme_settings, :gradient),
        "texture" => get(theme_settings, :texture),
        "effect" => get(theme_settings, :effect)
      }
    })
  end

  defp normalize_none(input, version) do
    if get(input, :source) in [nil, ""] and get(input, :custom_wallpaper) in [nil, %{}] and
         get(input, :render_config) in [nil, %{}] do
      {:ok, %{"settingsSchemaVersion" => version, "type" => "none"}}
    else
      {:error, ErrorCat.wallpaper_settings_invalid()}
    end
  end

  defp normalize_renderable(input, version, type) do
    source = get(input, :source)
    custom_wallpaper = get(input, :custom_wallpaper)
    render_config = get(input, :render_config)

    with true <- is_binary(source) and source != "",
         {:ok, render_config} <- normalize_render_config(render_config),
         true <- valid_custom_wallpaper?(custom_wallpaper) do
      {:ok,
       %{
         "customWallpaper" => canonical_custom_wallpaper(custom_wallpaper),
         "renderConfig" => render_config,
         "settingsSchemaVersion" => version,
         "source" => source,
         "type" => Atom.to_string(type)
       }}
    else
      _ -> {:error, ErrorCat.wallpaper_settings_invalid()}
    end
  end

  defp valid_custom_wallpaper?(nil), do: true

  defp valid_custom_wallpaper?(value) when is_map(value) do
    type = normalize_custom_type(get(value, :type))
    config = get(value, :config)
    asset_public_ref = get(value, :asset_public_ref)

    is_map(config) and
      ((type == :gradient and is_nil(asset_public_ref)) or
         (type == :picture and (is_nil(asset_public_ref) or is_binary(asset_public_ref))))
  end

  defp valid_custom_wallpaper?(_value), do: false

  defp normalize_render_config(value) when is_map(value) do
    keys = Enum.map(Map.keys(value), &canonical_render_config_key/1)

    if Enum.sort(keys) == Enum.sort(@render_config_keys) and
         is_map(get(value, :pattern)) and
         is_map(get(value, :texture)) and
         is_map(get(value, :effect)) and
         valid_gradient_recipe?(get(value, :gradient)) do
      {:ok,
       %{
         "effect" => get(value, :effect),
         "gradient" => get(value, :gradient),
         "pattern" => get(value, :pattern),
         "texture" => get(value, :texture)
       }}
    else
      :error
    end
  end

  defp normalize_render_config(_value), do: :error

  defp valid_gradient_recipe?(nil), do: true

  defp valid_gradient_recipe?(value) when is_map(value) do
    case normalize_gradient_renderer(get(value, :renderer)) do
      :linear -> valid_linear_recipe?(value)
      :radial -> valid_radial_recipe?(value)
      renderer when renderer in [:flow, :liquid] -> valid_mesh_recipe?(value)
      _ -> false
    end
  end

  defp valid_gradient_recipe?(_value), do: false

  defp valid_linear_recipe?(value) do
    has_only_keys?(value, @linear_recipe_required, @linear_recipe_optional) and
      get(value, :version) == 2 and
      is_binary(get(value, :preset)) and
      valid_string_list?(get(value, :colors)) and
      is_number_value?(get(value, :angle)) and
      is_number_value?(get(value, :spread)) and
      optional_number_list?(value, :stops)
  end

  defp valid_radial_recipe?(value) do
    has_only_keys?(value, @radial_recipe_required, @radial_recipe_optional) and
      get(value, :version) == 2 and
      is_binary(get(value, :preset)) and
      valid_string_list?(get(value, :colors)) and
      valid_gradient_center?(get(value, :center)) and
      is_number_value?(get(value, :radius)) and
      valid_gradient_shape?(get(value, :shape)) and
      is_number_value?(get(value, :spread)) and
      optional_number?(value, :angle) and
      optional_number_list?(value, :stops)
  end

  defp valid_mesh_recipe?(value) do
    has_only_keys?(value, @mesh_recipe_required) and
      get(value, :version) == 2 and
      normalize_gradient_renderer(get(value, :renderer)) in [:flow, :liquid] and
      is_binary(get(value, :preset)) and
      is_number_value?(get(value, :seed)) and
      valid_string_list?(get(value, :colors)) and
      is_number_value?(get(value, :angle)) and
      is_number_value?(get(value, :softness)) and
      is_number_value?(get(value, :warp)) and
      is_number_value?(get(value, :scale)) and
      is_number_value?(get(value, :contrast)) and
      is_number_value?(get(value, :brightness))
  end

  defp valid_gradient_center?(value) when is_map(value) do
    has_only_keys?(value, ~w(x y)) and
      is_number_value?(get(value, :x)) and
      is_number_value?(get(value, :y))
  end

  defp valid_gradient_center?(_value), do: false

  defp valid_gradient_shape?(value) when value in [:circle, :ellipse], do: true

  defp valid_gradient_shape?(value) when is_binary(value) do
    value in ["circle", "ellipse"]
  end

  defp valid_gradient_shape?(_value), do: false

  defp valid_string_list?(value) when is_list(value) do
    value != [] and Enum.all?(value, &is_binary/1)
  end

  defp valid_string_list?(_value), do: false

  defp valid_number_list?(value) when is_list(value), do: Enum.all?(value, &is_number_value?/1)

  defp valid_number_list?(_value), do: false

  defp optional_number?(value, key) do
    not has_key?(value, key) or is_number_value?(get(value, key))
  end

  defp optional_number_list?(value, key) do
    not has_key?(value, key) or valid_number_list?(get(value, key))
  end

  defp is_number_value?(value), do: is_integer(value) or is_float(value)

  defp has_only_keys?(value, required, optional \\ []) do
    keys = Enum.map(Map.keys(value), &to_string/1)
    allowed = MapSet.new(required ++ optional)
    required_keys = MapSet.new(required)
    actual = MapSet.new(keys)

    length(keys) == MapSet.size(actual) and MapSet.subset?(required_keys, actual) and
      MapSet.subset?(actual, allowed)
  end

  defp has_key?(value, key) do
    Enum.any?(Map.keys(value), &(to_string(&1) == Atom.to_string(key)))
  end

  defp normalize_gradient_renderer(value) when value in [:linear, :radial, :flow, :liquid] do
    value
  end

  defp normalize_gradient_renderer(value) when is_binary(value) do
    case value do
      "linear" -> :linear
      "radial" -> :radial
      "flow" -> :flow
      "liquid" -> :liquid
      _ -> nil
    end
  end

  defp normalize_gradient_renderer(_value), do: nil

  defp canonical_render_config_key(key) do
    case to_string(key) do
      key when key in ["effect", "gradient", "pattern", "texture"] -> key
      _ -> nil
    end
  end

  defp canonical_custom_wallpaper(value) when is_map(value) do
    %{
      "assetPublicRef" => get(value, :asset_public_ref),
      "config" => get(value, :config),
      "type" => value |> get(:type) |> normalize_custom_type() |> Atom.to_string()
    }
  end

  defp canonical_custom_wallpaper(nil), do: nil

  defp graphql_custom_wallpaper(nil), do: nil

  defp graphql_custom_wallpaper(value) do
    %{
      asset_public_ref: value["assetPublicRef"],
      config: value["config"],
      type: String.to_existing_atom(value["type"])
    }
  end

  defp normalize_type(value) when value in [:none, :picture, :gradient, :upload], do: value

  defp normalize_type(value) when is_binary(value) do
    case String.downcase(value) do
      value when value in ["none", "picture", "gradient", "upload"] ->
        String.to_existing_atom(value)

      _ ->
        nil
    end
  end

  defp normalize_type(_value), do: nil

  defp normalize_custom_type(value) when value in [:gradient, :picture], do: value

  defp normalize_custom_type(value) when value in [:GRADIENT, :PICTURE] do
    value |> Atom.to_string() |> String.downcase() |> String.to_existing_atom()
  end

  defp normalize_custom_type(value) when is_binary(value) do
    case String.downcase(value) do
      value when value in ["gradient", "picture"] -> String.to_existing_atom(value)
      _ -> nil
    end
  end

  defp normalize_custom_type(_value), do: nil

  defp get(map, key) when is_map(map) and is_atom(key) do
    snake_key = Atom.to_string(key)
    candidates = [key, snake_key, camel_key(snake_key)] |> Enum.uniq()

    Enum.reduce_while(candidates, nil, fn candidate, value ->
      case Map.fetch(map, candidate) do
        {:ok, found} -> {:halt, found}
        :error -> {:cont, value}
      end
    end)
  end

  defp get(_map, _key), do: nil

  defp camel_key(key) do
    case String.split(key, "_", trim: true) do
      [head | tail] -> head <> Enum.map_join(tail, &String.capitalize/1)
      [] -> key
    end
  end
end
