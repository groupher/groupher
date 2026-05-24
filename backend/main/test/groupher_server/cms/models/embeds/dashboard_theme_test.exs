defmodule GroupherServer.Test.CMS.Models.Embeds.DashboardThemeTest do
  @moduledoc false

  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Helper.ThemePreset
  alias GroupherServer.CMS.Model.Embeds.DashboardLayout

  test "default theme preset state is seeded in layout default" do
    assert DashboardLayout.default().theme_preset == :default
    assert DashboardLayout.default().custom_theme_preset == nil
  end

  test "accepts created custom preset with sparse overwrite" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        custom_theme_preset: %{
          "basePreset" => "claude",
          "overwrite" => %{
            "primaryColor" => "#B85C43",
            "pageBg" => "#fffaf0",
            "pageBgHue" => 42,
            "pageBgHueDark" => 318,
            "pageBgIntensity" => 52,
            "pageBgIntensityDark" => 61,
            "cardColor" => "#fffdf8",
            "dividerColorDark" => "#3a3035"
          }
        }
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.theme_preset == :custom
    assert layout.custom_theme_preset["basePreset"] == "claude"
    overwrite = layout.custom_theme_preset["overwrite"]
    assert overwrite["primaryColor"] == "#B85C43"
    assert overwrite["pageBgHue"] == 42
    assert overwrite["pageBgHueDark"] == 318
    assert overwrite["pageBgIntensity"] == 52
    assert overwrite["pageBgIntensityDark"] == 61
    assert overwrite["cardColor"] == "#fffdf8"
    assert overwrite["dividerColorDark"] == "#3a3035"
  end

  test "built-in theme preset ignores stored custom preset when resolving tokens" do
    tokens =
      ThemePreset.resolve(:claude, %{
        "basePreset" => "claude",
        "overwrite" => %{"glowType" => "ORANGE_PURPLE", "glowOpacity" => 90}
      })

    assert tokens["glowType"] == ""
    assert tokens["glowOpacity"] == 100
    assert tokens["pageBgHue"] == 48
    assert tokens["pageBgIntensity"] == 32
  end

  test "validates sparse theme overwrite keys and values" do
    assert {:ok, %{"gaussBlur" => 72, "glowFixed" => false}} =
             ThemePreset.validate_overwrite(%{"gaussBlur" => 72, "glowFixed" => false})

    assert {:error, {:custom, "invalid theme overwrite key: \"unknownToken\""}} =
             ThemePreset.validate_overwrite(%{"unknownToken" => "#fff"})

    assert {:error, {:custom, "invalid theme overwrite value: gaussBlur"}} =
             ThemePreset.validate_overwrite(%{"gaussBlur" => "72"})

    assert {:error, {:custom, "invalid theme overwrite value: primaryColor"}} =
             ThemePreset.validate_overwrite(%{"primaryColor" => "YELLOW"})

    assert {:error, {:custom, "invalid theme overwrite value: glowOpacity"}} =
             ThemePreset.validate_overwrite(%{"glowOpacity" => 101})

    assert {:error, {:custom, "invalid theme overwrite value: pageBgHue"}} =
             ThemePreset.validate_overwrite(%{"pageBgHue" => -1})
  end

  test "merges sparse overwrite and removes values equal to the base preset" do
    assert {:ok, overwrite} =
             ThemePreset.merge_overwrite(
               :claude,
               %{"cardColor" => "#ffffff", "textTitle" => "#111111"},
               %{"cardColor" => "#fffdf8", "gaussBlur" => 72}
             )

    assert overwrite == %{"textTitle" => "#111111", "gaussBlur" => 72}
  end

  test "empty custom overwrite still means custom preset was created" do
    custom_preset = ThemePreset.build_custom_preset(:claude, %{})

    assert ThemePreset.validate_custom_preset(custom_preset) == :ok
    assert ThemePreset.options(custom_preset) |> Enum.any?(&(&1.value == :custom))
    assert ThemePreset.resolve_custom_preset(custom_preset)["primaryColor"] == "#c96442"
  end

  test "stores custom preset maps without JSON decoding" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        custom_theme_preset: %{
          "basePreset" => "claude",
          "overwrite" => %{
            "accentColor" => "#ffee00",
            "accentColorDark" => "#112233"
          }
        }
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.custom_theme_preset["overwrite"] == %{
             "accentColor" => "#ffee00",
             "accentColorDark" => "#112233"
           }
  end

  test "rejects JSON string custom preset values" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        custom_theme_preset: Jason.encode!(%{"basePreset" => "claude", "overwrite" => %{}})
      })

    refute changeset.valid?
    assert errors_on(changeset).custom_theme_preset == ["is invalid"]
  end

  test "rejects invalid custom preset overwrite values" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        custom_theme_preset: %{
          "basePreset" => "claude",
          "overwrite" => %{"gaussBlur" => "72"}
        }
      })

    refute changeset.valid?

    assert errors_on(changeset).custom_theme_preset == [
             "invalid theme overwrite value: gaussBlur"
           ]
  end

  test "rejects malformed custom preset definitions" do
    missing_base =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        custom_theme_preset: %{"overwrite" => %{}}
      })

    atom_keys =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        custom_theme_preset: %{basePreset: "claude", overwrite: %{}}
      })

    unknown_base =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        custom_theme_preset: %{"basePreset" => "unknown", "overwrite" => %{}}
      })

    refute missing_base.valid?
    refute atom_keys.valid?
    refute unknown_base.valid?
    assert errors_on(missing_base).custom_theme_preset == ["requires basePreset and overwrite"]
    assert errors_on(atom_keys).custom_theme_preset == ["requires basePreset and overwrite"]
    assert errors_on(unknown_base).custom_theme_preset == ["invalid basePreset"]
  end

  test "keeps custom preset when updating non-preset layout fields" do
    changeset =
      DashboardLayout.changeset(
        %DashboardLayout{
          custom_theme_preset: %{
            "basePreset" => "claude",
            "overwrite" => %{"accentColor" => "#112233"}
          }
        },
        %{post_layout: :cover}
      )

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.post_layout == :cover
    assert layout.custom_theme_preset["overwrite"] == %{"accentColor" => "#112233"}
  end

  test "rejects invalid theme preset payloads" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "unknown",
        custom_theme_preset: "not-a-map"
      })

    refute changeset.valid?
    assert errors_on(changeset).theme_preset == ["is invalid"]
    assert errors_on(changeset).custom_theme_preset == ["is invalid"]
  end

  defp errors_on(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {message, _opts} -> message end)
  end
end
