defmodule GroupherServer.CMS.DocImport.NavigationPlannerTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.DocImport.Adapters.Nextra
  alias GroupherServer.CMS.DocImport.NavigationPlanner

  @fixture Path.expand("../../../fixtures/doc_import/nextra/basic", __DIR__)

  test "introduces Groupher groups only after source extraction" do
    assert {:ok, %{tree: source_tree}} = Nextra.parse(@fixture)

    guide = Enum.find(source_tree["navigation"], &(&1["title"] == "Guide"))

    assert Enum.map(guide["children"], & &1["kind"]) == ["page", "page", "section"]
    refute Enum.any?(guide["children"], &(&1["title"] == "Pages"))

    planned = NavigationPlanner.plan(source_tree)
    planned_guide = Enum.find(planned["tabs"], &(&1["title"] == "Guide"))

    assert planned["schemaVersion"] == 1
    assert Enum.map(planned_guide["groups"], & &1["title"]) == ["Overview", "Advanced"]

    assert Enum.map(hd(planned_guide["groups"])["children"], & &1["title"]) == [
             "Introduction",
             "Installation"
           ]
  end

  test "flattens deeper source sections into Groupher sibling groups" do
    source_tree = %{
      "source" => %{"framework" => "test", "root" => "docs", "configPaths" => []},
      "navigation" => [
        %{
          "kind" => "scope",
          "sourceId" => "scope:guide",
          "title" => "Guide",
          "routePrefix" => "/guide/",
          "children" => [
            %{
              "kind" => "section",
              "sourceId" => "section:advanced",
              "title" => "Advanced",
              "children" => [
                %{
                  "kind" => "section",
                  "sourceId" => "section:performance",
                  "title" => "Performance",
                  "children" => [
                    %{
                      "kind" => "page",
                      "sourceId" => "docs/performance.md",
                      "sourcePath" => "docs/performance.md",
                      "title" => "Performance Guide",
                      "route" => "/guide/performance"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }

    [tab] = NavigationPlanner.plan(source_tree)["tabs"]
    assert Enum.map(tab["groups"], & &1["title"]) == ["Performance"]
  end
end
