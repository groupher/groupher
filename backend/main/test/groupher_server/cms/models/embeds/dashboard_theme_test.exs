defmodule GroupherServer.Test.CMS.Models.Embeds.DashboardThemeTest do
  @moduledoc false

  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Helper.ThemePreset
  alias GroupherServer.CMS.Model.Embeds.DashboardLayout

  test "default theme preset state is seeded in layout default" do
    assert DashboardLayout.default().theme_preset == :default
    assert DashboardLayout.default().theme_preset_base == :default
    assert DashboardLayout.default().theme_overwrite == %{}
  end

  test "accepts theme preset with sparse overwrite" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        theme_preset_base: "claude",
        theme_overwrite: %{
          "primaryColor" => "#B85C43",
          "pageBg" => "#fffaf0",
          "pageBgHue" => 42,
          "pageBgHueDark" => 318,
          "pageBgIntensity" => 52,
          "pageBgIntensityDark" => 61,
          "cardColor" => "#fffdf8",
          "dividerColorDark" => "#3a3035"
        }
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.theme_preset == :custom
    assert layout.theme_preset_base == :claude
    assert layout.theme_overwrite["primaryColor"] == "#B85C43"
    assert layout.theme_overwrite["pageBgHue"] == 42
    assert layout.theme_overwrite["pageBgHueDark"] == 318
    assert layout.theme_overwrite["pageBgIntensity"] == 52
    assert layout.theme_overwrite["pageBgIntensityDark"] == 61
    assert layout.theme_overwrite["cardColor"] == "#fffdf8"
    assert layout.theme_overwrite["dividerColorDark"] == "#3a3035"
  end

  test "built-in theme preset ignores stale overwrite when resolving tokens" do
    tokens =
      ThemePreset.resolve(:claude, %{
        "glowType" => "ORANGE_PURPLE",
        "glowOpacity" => 90
      })

    assert tokens["glowType"] == ""
    assert tokens["glowOpacity"] == 100
    assert tokens["pageBgHue"] == 48
    assert tokens["pageBgIntensity"] == 32
  end

  test "stores theme overwrite maps without JSON decoding" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        theme_overwrite: %{
          "accentColor" => "YELLOW",
          "accentColorDark" => "#112233"
        }
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.theme_overwrite == %{
             "accentColor" => "YELLOW",
             "accentColorDark" => "#112233"
           }
  end

  test "rejects JSON string theme overwrite values" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        theme_overwrite: Jason.encode!(%{"accentColor" => "#112233"})
      })

    refute changeset.valid?
    assert errors_on(changeset).theme_overwrite == ["is invalid"]
  end

  test "rejects non-map theme overwrite values instead of normalizing them to empty maps" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        theme_overwrite: 42
      })

    refute changeset.valid?
    assert errors_on(changeset).theme_overwrite == ["is invalid"]
  end

  test "keeps theme overwrite when updating non-preset layout fields" do
    changeset =
      DashboardLayout.changeset(
        %DashboardLayout{theme_overwrite: %{"accentColor" => "#112233"}},
        %{post_layout: :cover}
      )

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.post_layout == :cover
    assert layout.theme_overwrite == %{"accentColor" => "#112233"}
  end

  test "rejects invalid theme preset payloads" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "unknown",
        theme_overwrite: "not-a-map"
      })

    refute changeset.valid?
    assert errors_on(changeset).theme_preset == ["is invalid"]
    assert errors_on(changeset).theme_overwrite == ["is invalid"]
  end

  defp errors_on(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {message, _opts} -> message end)
  end
end
