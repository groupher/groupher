defmodule GroupherServer.Test.CMS.Models.Embeds.Dashboard.LayoutTest do
  @moduledoc false

  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Model.Embeds.Dashboard.Layout
  alias GroupherServer.CMS.Dashboard.Fields, as: Dashboard

  test "default xx_layout values are seeded in layout default" do
    assert Layout.default() == Dashboard.layout_default()
  end

  test "default kanban colors are seeded in layout default" do
    assert Layout.default().kanban_bg_colors == Dashboard.kanban_bg_colors_default()
  end

  test "changeset accepts current enum values" do
    changeset =
      Layout.changeset(%Layout{}, %{
        post_layout: :cover,
        kanban_bg_colors: [:black, :yellow],
        kanban_boards: [:backlog, :done]
      })

    assert changeset.valid?

    layout = Ecto.Changeset.apply_changes(changeset)

    assert layout.post_layout == :cover
    assert layout.kanban_bg_colors == [:black, :yellow]
    assert layout.kanban_boards == [:backlog, :done]
  end
end
