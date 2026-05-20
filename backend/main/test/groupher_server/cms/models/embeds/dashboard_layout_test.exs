defmodule GroupherServer.Test.CMS.Models.Embeds.DashboardLayoutTest do
  @moduledoc false

  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Model.Embeds.DashboardLayout
  alias GroupherServer.CMS.Model.Metrics.Dashboard

  test "default xx_layout values are seeded in layout default" do
    assert DashboardLayout.default() == Dashboard.layout_default()
  end

  test "default kanban colors are seeded in layout default" do
    assert DashboardLayout.default().kanban_bg_colors == Dashboard.kanban_bg_colors_default()
  end

  test "default theme preset fields are seeded in layout default" do
    assert DashboardLayout.default().theme_preset == :default
    assert DashboardLayout.default().theme_overrides == %{}
    assert DashboardLayout.default().text_title == "#243041"
    assert DashboardLayout.default().text_digest == "#6b7280"
  end

  test "accepts theme preset with sparse overrides" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        theme_overrides: %{"primaryColor" => "#B85C43", "pageBg" => "CUSTOM"}
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.theme_preset == :custom
    assert layout.theme_overrides["primaryColor"] == "#B85C43"
  end

  test "normalizes theme overwrite into stored theme overrides" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "custom",
        theme_overwrite:
          Jason.encode!(%{
            "accentColor" => "YELLOW",
            "accentCustomColor" => "#112233",
            "unknown" => "ignored"
          })
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.theme_overrides == %{
             "accentColor" => "YELLOW",
             "accentCustomColor" => "#112233"
           }
  end

  test "keeps theme overrides when updating non-preset layout fields" do
    changeset =
      DashboardLayout.changeset(
        %DashboardLayout{theme_overrides: %{"accentColor" => "YELLOW"}},
        %{post_layout: "COVER"}
      )

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.post_layout == :cover
    assert layout.theme_overrides == %{"accentColor" => "YELLOW"}
  end

  test "rejects invalid theme preset payloads" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        theme_preset: "unknown",
        theme_overrides: "not-a-map"
      })

    refute changeset.valid?
    assert errors_on(changeset).theme_preset == ["is invalid"]
    assert errors_on(changeset).theme_overrides == ["is invalid"]
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
