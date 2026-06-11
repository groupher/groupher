defmodule GroupherServer.Test.CMS.Dashboard.ThemePresetTest do
  @moduledoc false

  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Dashboard.ThemePreset
  alias GroupherServer.CMS.Model.Embeds.Dashboard.Layout

  test "default theme preset state is seeded in layout default" do
    assert Layout.default().theme_preset == :default
    assert Layout.default().custom_theme_preset == nil
  end

  test "accepts created custom preset with sparse overwrite" do
    changeset =
      Layout.changeset(%Layout{}, %{
        theme_preset: "custom",
        custom_theme_preset: %{
          "basePreset" => "claude",
          "overwrite" => %{
            "shared" => %{"glowFixed" => false},
            "light" => %{
              "primaryColor" => "#B85C43",
              "pageBg" => "#fffaf0",
              "pageBgHue" => 42,
              "pageBgIntensity" => 52,
              "cardColor" => "#fffdf8"
            },
            "dark" => %{
              "pageBgHue" => 318,
              "pageBgIntensity" => 61,
              "dividerColor" => "#3a3035"
            }
          }
        }
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.theme_preset == :custom
    assert layout.custom_theme_preset["basePreset"] == "claude"
    overwrite = layout.custom_theme_preset["overwrite"]
    assert overwrite["shared"]["glowFixed"] == false
    assert overwrite["light"]["primaryColor"] == "#B85C43"
    assert overwrite["light"]["pageBgHue"] == 42
    assert overwrite["light"]["pageBgIntensity"] == 52
    assert overwrite["light"]["cardColor"] == "#fffdf8"
    assert overwrite["dark"]["pageBgHue"] == 318
    assert overwrite["dark"]["pageBgIntensity"] == 61
    assert overwrite["dark"]["dividerColor"] == "#3a3035"
  end

  test "built-in theme preset ignores stored custom preset when resolving tokens" do
    tokens =
      ThemePreset.resolve(:claude, %{
        "basePreset" => "claude",
        "overwrite" => %{"light" => %{"glowType" => "ORANGE_PURPLE", "glowOpacity" => 90}}
      })

    assert tokens["light"]["glowType"] == ""
    assert tokens["light"]["glowOpacity"] == 100
    assert tokens["light"]["pageBgHue"] == 48
    assert tokens["light"]["pageBgIntensity"] == 32
  end

  test "validates sparse theme overwrite keys and values" do
    assert {:ok, %{"light" => %{"gaussBlur" => 72}, "shared" => %{"glowFixed" => false}}} =
             ThemePreset.validate_overwrite(%{
               "light" => %{"gaussBlur" => 72},
               "shared" => %{"glowFixed" => false}
             })

    assert {:error, {:custom, "invalid theme overwrite key: \"light.unknownToken\""}} =
             ThemePreset.validate_overwrite(%{"light" => %{"unknownToken" => "#fff"}})

    assert {:error, {:custom, "invalid theme overwrite value: light.gaussBlur"}} =
             ThemePreset.validate_overwrite(%{"light" => %{"gaussBlur" => "72"}})

    assert {:error, {:custom, "invalid theme overwrite value: light.primaryColor"}} =
             ThemePreset.validate_overwrite(%{"light" => %{"primaryColor" => "YELLOW"}})

    assert {:error, {:custom, "invalid theme overwrite value: dark.glowOpacity"}} =
             ThemePreset.validate_overwrite(%{"dark" => %{"glowOpacity" => 101}})

    assert {:error, {:custom, "invalid theme overwrite value: light.pageBgHue"}} =
             ThemePreset.validate_overwrite(%{"light" => %{"pageBgHue" => -1}})
  end

  test "merges sparse overwrite and removes values equal to the base preset" do
    assert {:ok, overwrite} =
             ThemePreset.merge_overwrite(
               :claude,
               %{"light" => %{"cardColor" => "#ffffff", "textTitle" => "#111111"}},
               %{"light" => %{"cardColor" => "#fffdf8", "gaussBlur" => 72}}
             )

    assert overwrite == %{"light" => %{"textTitle" => "#111111", "gaussBlur" => 72}}
  end

  test "empty custom overwrite still means custom preset was created" do
    custom_preset = ThemePreset.build_custom_preset(:claude, %{})

    assert ThemePreset.validate_custom_preset(custom_preset) == :ok
    assert ThemePreset.options(custom_preset) |> Enum.any?(&(&1.value == :custom))
    assert ThemePreset.resolve_custom_preset(custom_preset)["light"]["primaryColor"] == "#c96442"
  end

  test "stores custom preset maps without JSON decoding" do
    changeset =
      Layout.changeset(%Layout{}, %{
        theme_preset: "custom",
        custom_theme_preset: %{
          "basePreset" => "claude",
          "overwrite" => %{
            "light" => %{"accentColor" => "#ffee00"},
            "dark" => %{"accentColor" => "#112233"}
          }
        }
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.custom_theme_preset["overwrite"] == %{
             "light" => %{"accentColor" => "#ffee00"},
             "dark" => %{"accentColor" => "#112233"}
           }
  end

  test "rejects JSON string custom preset values" do
    changeset =
      Layout.changeset(%Layout{}, %{
        theme_preset: "custom",
        custom_theme_preset: Jason.encode!(%{"basePreset" => "claude", "overwrite" => %{}})
      })

    refute changeset.valid?
    assert errors_on(changeset).custom_theme_preset == ["is invalid"]
  end

  test "rejects invalid custom preset overwrite values" do
    changeset =
      Layout.changeset(%Layout{}, %{
        theme_preset: "custom",
        custom_theme_preset: %{
          "basePreset" => "claude",
          "overwrite" => %{"light" => %{"gaussBlur" => "72"}}
        }
      })

    refute changeset.valid?

    assert errors_on(changeset).custom_theme_preset == [
             "invalid theme overwrite value: light.gaussBlur"
           ]
  end

  test "rejects malformed custom preset definitions" do
    missing_base =
      Layout.changeset(%Layout{}, %{
        theme_preset: "custom",
        custom_theme_preset: %{"overwrite" => %{}}
      })

    atom_keys =
      Layout.changeset(%Layout{}, %{
        theme_preset: "custom",
        custom_theme_preset: %{basePreset: "claude", overwrite: %{}}
      })

    unknown_base =
      Layout.changeset(%Layout{}, %{
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
      Layout.changeset(
        %Layout{
          custom_theme_preset: %{
            "basePreset" => "claude",
            "overwrite" => %{"light" => %{"accentColor" => "#112233"}}
          }
        },
        %{post_layout: :cover}
      )

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.post_layout == :cover
    assert layout.custom_theme_preset["overwrite"] == %{"light" => %{"accentColor" => "#112233"}}
  end

  test "rejects invalid theme preset payloads" do
    changeset =
      Layout.changeset(%Layout{}, %{
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
