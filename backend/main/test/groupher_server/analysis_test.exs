defmodule GroupherServer.AnalysisTest do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.Analysis
  alias GroupherServer.Analysis.Provider.Umami
  alias GroupherServer.CMS.Model.Community

  describe "Umami path metric projection" do
    test "aggregates only paths under the community prefix" do
      rows = [
        %{
          "name" => "/home/post/1",
          "pageviews" => 10,
          "visitors" => 4,
          "visits" => 5,
          "bounces" => 1,
          "totaltime" => 60
        },
        %{
          "name" => "/home/doc/intro",
          "pageviews" => 7,
          "visitors" => 3,
          "visits" => 3,
          "bounces" => 2,
          "totaltime" => 30
        },
        %{
          "name" => "/feedback/post/1",
          "pageviews" => 99,
          "visitors" => 30,
          "visits" => 40,
          "bounces" => 10,
          "totaltime" => 300
        }
      ]

      result = Umami.aggregate_path_metrics(rows, "/home")

      assert result.summary == %{
               pageviews: 17,
               visitors: 7,
               visits: 8,
               bounces: 3,
               total_time: 90
             }

      assert Enum.map(result.top_pages, & &1.path) == ["/home/post/1", "/home/doc/intro"]
    end

    test "does not treat same-prefix sibling slugs as in scope" do
      rows = [
        %{"name" => "/home", "pageviews" => 1},
        %{"name" => "/homebase", "pageviews" => 10}
      ]

      result = Umami.aggregate_path_metrics(rows, "/home")

      assert result.summary.pageviews == 1
      assert Enum.map(result.top_pages, & &1.path) == ["/home"]
    end

    test "reads one total time value from supported Umami field names" do
      rows = [
        %{"name" => "/home", "pageviews" => 1, "totaltime" => 60, "totalTime" => 60},
        %{"name" => "/home/post/1", "pageviews" => 1, :totaltime => 30}
      ]

      result = Umami.aggregate_path_metrics(rows, "/home")

      assert result.summary.total_time == 90
    end
  end

  describe "summary fallback" do
    test "returns unavailable DTO when Umami is not configured" do
      previous = Application.get_env(:groupher_server, :web_analysis)
      Application.put_env(:groupher_server, :web_analysis, website_id: "test")

      on_exit(fn ->
        Application.put_env(:groupher_server, :web_analysis, previous)
      end)

      {:ok, result} = Analysis.summary(%Community{slug: "home"})

      assert result.status == "unavailable"
      assert result.path_scope == "/home"
      assert result.summary.pageviews == 0
      assert result.top_pages == []
    end
  end
end
