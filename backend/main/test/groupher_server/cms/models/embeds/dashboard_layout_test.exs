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

  test "changeset normalizes legacy uppercase enum strings" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        primary_color: "BLACK",
        post_layout: "COVER",
        kanban_bg_colors: ["BLACK", "YELLOW"],
        kanban_boards: ["BACKLOG", "DONE"]
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.primary_color == :black
    assert layout.post_layout == :cover
    assert layout.kanban_bg_colors == [:black, :yellow]
    assert layout.kanban_boards == [:backlog, :done]
  end

  test "accepts valid custom colors for primary and sub-primary in both themes" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        primary_custom_color: "#112233",
        primary_custom_color_dark: "#223344",
        sub_primary_custom_color: "#334455",
        sub_primary_custom_color_dark: "#445566"
      })

    assert changeset.valid?
  end

  test "rejects invalid custom colors for primary and sub-primary in both themes" do
    changeset =
      DashboardLayout.changeset(%DashboardLayout{}, %{
        primary_custom_color: "red",
        primary_custom_color_dark: "#fff",
        sub_primary_custom_color: "var(--x)",
        sub_primary_custom_color_dark: "#12345g"
      })

    refute changeset.valid?
    assert errors_on(changeset).primary_custom_color == ["must be a valid hex color"]
    assert errors_on(changeset).primary_custom_color_dark == ["must be a valid hex color"]
    assert errors_on(changeset).sub_primary_custom_color == ["must be a valid hex color"]
    assert errors_on(changeset).sub_primary_custom_color_dark == ["must be a valid hex color"]
  end

  defp errors_on(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {message, _opts} -> message end)
  end
end
