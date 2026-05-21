defmodule GroupherServer.Test.CMS.Models.Embeds.DashboardLayoutTest do
  @moduledoc false

  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Model.Embeds.DashboardLayout
  alias GroupherServer.CMS.Model.Metrics.Dashboard
  alias GroupherServer.CMS.Helper.ThemePreset

  test "default xx_layout values are seeded in layout default" do
    assert DashboardLayout.default() == Dashboard.layout_default()
  end

  test "default kanban colors are seeded in layout default" do
    assert DashboardLayout.default().kanban_bg_colors == Dashboard.kanban_bg_colors_default()
  end

  test "default theme preset fields are seeded in layout default" do
    assert DashboardLayout.default().theme_preset == :default
    assert DashboardLayout.default().theme_preset_base == :default
    assert DashboardLayout.default().theme_overwrite == %{}
    assert DashboardLayout.default().text_title == "#243041"
    assert DashboardLayout.default().text_digest == "#6b7280"
  end

  test "accepts theme preset with sparse overwrite" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        theme_preset_base: "claude",
        theme_overwrite: %{"primaryColor" => "#B85C43", "pageBg" => "#fffaf0"}
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.theme_preset == :custom
    assert layout.theme_preset_base == :claude
    assert layout.theme_overwrite["primaryColor"] == "#B85C43"
  end

  test "built-in theme preset ignores stale overwrite when resolving tokens" do
    tokens =
      ThemePreset.resolve(:claude, %{
        "glowType" => "ORANGE_PURPLE",
        "glowOpacity" => 90
      })

    assert tokens["glowType"] == ""
    assert tokens["glowOpacity"] == 100
  end

  test "normalizes theme overwrite into stored theme overwrite" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        theme_overwrite:
          Jason.encode!(%{
            "accentColor" => "YELLOW",
            "accentColorDark" => "#112233",
            "unknown" => "ignored"
          })
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.theme_overwrite == %{
             "accentColor" => "YELLOW",
             "accentColorDark" => "#112233"
           }
  end

  test "rejects invalid theme overwrite instead of silently ignoring it" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        theme_overwrite: "{invalid-json"
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

  test "ignores empty theme overwrite keys without raising" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        theme_overwrite: Jason.encode!(%{"" => "ignored", "accentColor" => "#112233"})
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.theme_overwrite == %{"accentColor" => "#112233"}
  end

  test "keeps theme overwrite when updating non-preset layout fields" do
    changeset =
      DashboardLayout.changeset(
        %DashboardLayout{theme_overwrite: %{"accentColor" => "#112233"}},
        %{post_layout: "COVER"}
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

  test "changeset normalizes legacy uppercase enum strings" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        post_layout: "COVER",
        kanban_bg_colors: ["BLACK", "YELLOW"],
        kanban_boards: ["BACKLOG", "DONE"]
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.post_layout == :cover
    assert layout.kanban_bg_colors == [:black, :yellow]
    assert layout.kanban_boards == [:backlog, :done]
  end

  test "accepts valid custom text colors" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        text_title: "#556677",
        text_digest: "#667788"
      })

    assert changeset.valid?
  end

  test "rejects invalid custom text colors" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        text_title: "oklch(1 0 0)",
        text_digest: "#12345g"
      })

    refute changeset.valid?
    assert errors_on(changeset).text_title == ["must be a valid hex color"]
    assert errors_on(changeset).text_digest == ["must be a valid hex color"]
  end

  defp errors_on(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {message, _opts} -> message end)
  end
end
