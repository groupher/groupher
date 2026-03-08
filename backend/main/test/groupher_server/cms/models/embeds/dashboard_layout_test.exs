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
end
