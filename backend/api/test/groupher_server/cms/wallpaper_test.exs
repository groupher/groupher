defmodule GroupherServer.CMS.WallpaperTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Dashboard.Fields
  alias CMS.Wallpaper
  alias CMS.Wallpaper.{RequestDigest, Settings}

  @settings_fixture_path Path.expand(
                           "../../../../../packages/contracts/fixtures/wallpaper-settings-v1.json",
                           __DIR__
                         )

  test "returns the backend profile matrix" do
    assert Enum.map(Wallpaper.profile_specs(), & &1.key) == [:wide, :desktop, :tablet, :phone]
  end

  test "returns built-in profiles and editor defaults without creating snapshots before the first save" do
    {community, _article, _attrs, _user} = mock_article(:post)

    wallpaper = Wallpaper.wallpaper(community.id)
    settings = Wallpaper.wallpaper_settings(community.id)

    assert wallpaper.version == 0

    for theme <- [:light, :dark] do
      assert wallpaper[theme].wide.url == "/wallpaper/default-v1/#{theme}-wide.webp"
      assert wallpaper[theme].phone.width == 390
      assert wallpaper[theme].phone.height == 844
      assert wallpaper[:"#{theme}_source"] == settings[theme].source
      assert settings[theme].type == :gradient
    end

    refute Repo.get_by(CMS.Model.CommunityWallpaper, community_id: community.id)
  end

  test "an explicit NONE does not replace the other theme's uninitialized default" do
    {community, _article, _attrs, user} = mock_article(:post)

    assert {:ok, _} =
             Wallpaper.publish(
               community,
               %{
                 base_version: 0,
                 command_id: Ecto.UUID.generate(),
                 theme: :light,
                 settings: %{settings_schema_version: 1, type: :none}
               },
               user
             )

    wallpaper = Wallpaper.wallpaper(community.id)
    assert wallpaper.version == 1
    assert wallpaper.light == nil
    assert wallpaper.light_source == nil
    assert wallpaper.dark.wide.url == "/wallpaper/default-v1/dark-wide.webp"
    assert Wallpaper.wallpaper_settings(community.id).light.type == :none
  end

  test "lifecycle reconciliation returns a typed empty summary" do
    assert {:ok, %{orphan_assets: 0, receipts: 0, snapshots: 0}} =
             Wallpaper.reconcile_lifecycle()
  end

  test "published wallpaper defaults do not contain the legacy static revision" do
    refute Map.has_key?(Fields.wallpaper_default(), :static_revision)
  end

  test "settings normalize NONE without a second default value" do
    assert {:ok, settings} =
             Settings.normalize(%{
               settings_schema_version: 1,
               type: :none,
               source: nil,
               custom_wallpaper: nil,
               render_config: nil
             })

    assert settings == %{"settingsSchemaVersion" => 1, "type" => "none"}
    assert Settings.to_graphql(settings).type == :none
  end

  test "settings reject stale render fields on NONE" do
    assert {:error, error} =
             Settings.normalize(%{
               settings_schema_version: 1,
               type: :none,
               source: "stale",
               custom_wallpaper: nil,
               render_config: %{}
             })

    assert error.reason == :wallpaper_settings_invalid
  end

  test "settings reject incomplete render config" do
    assert {:error, error} =
             Settings.normalize(%{
               settings_schema_version: 1,
               type: :gradient,
               source: "amber_mauve",
               custom_wallpaper: nil,
               render_config: %{"contentShadow" => %{"enabled" => false}}
             })

    assert error.reason == :wallpaper_settings_invalid
  end

  test "settings accept every shared cross-language fixture branch" do
    fixture = settings_fixture()

    for key <- ["none", "radial", "mesh", "meshLiquid", "gradientCustomWallpaper"] do
      assert {:ok, _settings} = Settings.normalize(fixture[key]["transport"]), "fixture: #{key}"
    end

    assert {:ok, _settings} = Settings.normalize(fixture["transport"]), "fixture: linear"
  end

  test "settings reject cross-family gradient fields and unsupported recipe versions" do
    fixture = settings_fixture()
    transport = fixture["transport"]
    render_config = transport["renderConfig"]
    linear = render_config["gradient"]

    invalid_family =
      transport
      |> Map.put(
        "renderConfig",
        Map.put(render_config, "gradient", Map.put(linear, "center", %{"x" => 0.5, "y" => 0.5}))
      )

    invalid_version =
      transport
      |> Map.put(
        "renderConfig",
        Map.put(render_config, "gradient", Map.put(linear, "version", 1))
      )

    assert {:error, error} = Settings.normalize(invalid_family)
    assert error.reason == :wallpaper_settings_invalid
    assert {:error, error} = Settings.normalize(invalid_version)
    assert error.reason == :wallpaper_settings_invalid
  end

  test "settings reject a mismatched persisted version mirror" do
    settings = %{"settingsSchemaVersion" => 1, "type" => "none"}

    assert_raise ArgumentError, ~r/WALLPAPER_SETTINGS_VERSION_MISMATCH/, fn ->
      Settings.assert_persisted_version!(settings, 2)
    end
  end

  test "settings preserve custom picture asset refs outside config" do
    assert {:ok, settings} =
             Settings.normalize(%{
               settings_schema_version: 1,
               type: :upload,
               source: "https://example.com/source.webp",
               custom_wallpaper: %{
                 type: :picture,
                 asset_public_ref: "asset_picture",
                 config: %{"image" => "https://example.com/source.webp"}
               },
               render_config: %{
                 "effect" => %{"blurIntensity" => 0, "brightness" => 100, "saturation" => 100},
                 "gradient" => nil,
                 "pattern" => %{
                   "enabled" => false,
                   "id" => "01",
                   "intensity" => 0,
                   "tone" => "dark"
                 },
                 "texture" => %{
                   "enabled" => false,
                   "intensity" => 0,
                   "params" => %{},
                   "type" => "noise"
                 }
               }
             })

    assert settings["customWallpaper"] == %{
             "assetPublicRef" => "asset_picture",
             "config" => %{"image" => "https://example.com/source.webp"},
             "type" => "picture"
           }
  end

  test "request digest is stable for map ordering and includes one theme" do
    first = %{
      base_version: 12,
      community_id: 9,
      request_digest_version: 1,
      settings: %{"settingsSchemaVersion" => 1, "type" => "none"},
      theme: :light
    }

    second = %{
      theme: :light,
      settings: %{"type" => "none", "settingsSchemaVersion" => 1},
      request_digest_version: 1,
      community_id: 9,
      base_version: 12
    }

    assert RequestDigest.canonical(first) == RequestDigest.canonical(second)
    assert RequestDigest.digest(first) == RequestDigest.digest(second)
  end

  test "backend defaults can be encoded as wallpaper settings" do
    defaults = Fields.wallpaper_default()
    assert {:ok, settings} = Settings.default(defaults.light)
    assert settings["type"] == "gradient"
    assert settings["settingsSchemaVersion"] == 1
  end

  defp settings_fixture do
    @settings_fixture_path
    |> File.read!()
    |> Jason.decode!()
  end
end
