defmodule GroupherServer.CMS.Wallpaper.Reader do
  @moduledoc """
  Reads active Wallpaper projections, editor settings, and retained history.

  Business position:

      CMS.Wallpaper facade
        -> Wallpaper.Reader
        -> Repo
        -> public/editor projection
  """

  import Ecto.Query, only: [from: 2]

  alias GroupherServer.{CMS, Repo}

  alias CMS.Dashboard.Fields, as: DashboardFields
  alias CMS.Model.{CommunityWallpaper, WallpaperSnapshot, WallpaperSnapshotImage}
  alias CMS.Wallpaper.{Settings, Upload}

  @doc "Reports whether an Assets Hub Batch has already produced a Snapshot."
  def batch_published?(batch_ref) when is_binary(batch_ref) do
    from(snapshot in WallpaperSnapshot,
      where: snapshot.source_batch_ref == ^batch_ref,
      select: snapshot.public_ref,
      limit: 1
    )
    |> Repo.one()
    |> Kernel.!=(nil)
  end

  @doc "Returns the published image tree used by ordinary pages."
  def wallpaper(community_id) do
    state = Repo.get_by(CommunityWallpaper, community_id: community_id)
    {light, light_source} = published_theme(state && state.active_light_snapshot_ref, :light)
    {dark, dark_source} = published_theme(state && state.active_dark_snapshot_ref, :dark)

    %{
      version: state_version(state),
      light: light,
      dark: dark,
      light_source: light_source,
      dark_source: dark_source
    }
  end

  @doc "Returns complete settings for the editor, using Backend defaults when absent."
  def wallpaper_settings(community_id) do
    state = Repo.get_by(CommunityWallpaper, community_id: community_id)
    defaults = DashboardFields.wallpaper_default()

    %{
      light: settings_for_snapshot(state && state.active_light_snapshot_ref, defaults.light),
      dark: settings_for_snapshot(state && state.active_dark_snapshot_ref, defaults.dark)
    }
  end

  @doc "Returns retained history for the selected theme."
  def wallpaper_history(community_id, theme) when theme in [:light, :dark] do
    state = Repo.get_by(CommunityWallpaper, community_id: community_id)
    active_ref = active_snapshot_ref(state, theme)
    default = DashboardFields.wallpaper_default()[theme]

    from(snapshot in WallpaperSnapshot,
      where:
        snapshot.community_id == ^community_id and snapshot.theme == ^theme and
          is_nil(snapshot.delete_after),
      order_by: [desc: snapshot.history_used_at, desc: snapshot.inserted_at],
      limit: 5
    )
    |> Repo.all()
    |> Enum.filter(&supported_snapshot?/1)
    |> Enum.map(fn snapshot ->
      %{
        active: snapshot.public_ref == active_ref,
        id: snapshot.public_ref,
        saved_at: snapshot.inserted_at,
        settings: snapshot_settings(snapshot, default),
        theme: snapshot.theme
      }
    end)
  end

  @doc "Loads all generated images belonging to one Wallpaper Snapshot."
  def snapshot_images(snapshot_ref) do
    from(image in WallpaperSnapshotImage,
      where: image.wallpaper_snapshot_ref == ^snapshot_ref,
      order_by: [asc: image.profile]
    )
    |> Repo.all()
  end

  @doc "Checks whether a retained Snapshot can still be decoded by the active settings codec."
  def supported_snapshot?(%WallpaperSnapshot{
        settings: settings,
        settings_schema_version: version
      }) do
    graphql_settings = Settings.to_graphql(settings, version)
    match?({:ok, _settings}, Settings.normalize(graphql_settings))
  rescue
    ArgumentError -> false
  end

  @doc "Checks that one Snapshot has exactly one valid image for every profile."
  def complete_profile_manifest?(images) do
    Enum.sort(Enum.map(images, & &1.profile)) == Enum.sort(Upload.profiles()) and
      Enum.all?(images, fn image ->
        image.format == :webp and valid_asset_ref?(image.asset_public_ref)
      end)
  end

  @doc "Returns zero for an absent active-pointer row."
  def state_version(nil), do: 0
  def state_version(state), do: state.version

  defp published_theme(nil, _theme), do: {nil, nil}

  defp published_theme(snapshot_ref, theme) do
    case Repo.get_by(WallpaperSnapshot, public_ref: snapshot_ref, theme: theme) do
      %WallpaperSnapshot{settings: %{"type" => "none"}} ->
        {nil, nil}

      %WallpaperSnapshot{settings: settings} = snapshot ->
        images = snapshot_images(snapshot.public_ref)

        static_images =
          if complete_profile_manifest?(images),
            do: Map.new(images, &{&1.profile, static_image(&1)}),
            else: nil

        {static_images, Map.get(settings, "source")}

      _ ->
        {nil, nil}
    end
  end

  defp static_image(image) do
    %{
      height: image.height,
      url:
        "#{GroupherServer.CMS.Assets.Capability.public_endpoint()}/a/#{image.asset_public_ref}/original",
      width: image.width
    }
  end

  defp settings_for_snapshot(nil, default), do: default_settings(default)

  defp settings_for_snapshot(snapshot_ref, default) do
    case Repo.get_by(WallpaperSnapshot, public_ref: snapshot_ref) do
      %WallpaperSnapshot{} = snapshot -> snapshot_settings(snapshot, default)
      _ -> default_settings(default)
    end
  end

  defp snapshot_settings(
         %WallpaperSnapshot{settings: settings, settings_schema_version: version},
         _default
       ) do
    Settings.to_graphql(settings, version)
  end

  defp default_settings(default) do
    {:ok, settings} = Settings.default(default)
    Settings.to_graphql(settings)
  end

  defp active_snapshot_ref(nil, _theme), do: nil
  defp active_snapshot_ref(state, :light), do: state.active_light_snapshot_ref
  defp active_snapshot_ref(state, :dark), do: state.active_dark_snapshot_ref

  defp valid_asset_ref?(value), do: is_binary(value) and value != ""
end
