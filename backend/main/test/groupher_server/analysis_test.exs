defmodule GroupherServer.Analysis.WebTest do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.Analysis.Web
  alias GroupherServer.Analysis.Web.Config
  alias GroupherServer.Analysis.Web.Provider.Umami
  alias GroupherServer.CMS.Model.Community
  alias GroupherServer.ErrorCat.Error

  describe "config" do
    test "returns static base config without reading runtime env" do
      config = Config.base()

      assert %Config{} = config
      assert config.provider == Umami
      assert config.origin == "https://analysis.groupher.com"
      assert config.default_days == 7
      assert config.max_days == 90
    end

    test "returns runtime overrides only" do
      previous = Application.get_env(:groupher_server, :web_analysis)

      Application.put_env(:groupher_server, :web_analysis,
        api_token: "token",
        timeout: -1
      )

      on_exit(fn ->
        Application.put_env(:groupher_server, :web_analysis, previous)
      end)

      config = Config.runtime()

      assert %Config.Runtime{} = config
      assert config.api_token == "token"
      refute Map.has_key?(config, :timeout)
    end
  end

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

    test "summarizes all scoped rows before limiting top pages" do
      rows =
        1..12
        |> Enum.map(fn index ->
          %{
            "name" => "/home/post/#{index}",
            "pageviews" => 1,
            "visitors" => 1,
            "visits" => 1
          }
        end)

      result = Umami.aggregate_path_metrics(rows, "/home")

      assert result.summary.pageviews == 12
      assert result.summary.visitors == 12
      assert result.summary.visits == 12
      assert length(result.top_pages) == 10
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

  describe "Umami active visitor projection" do
    test "accepts a zero active visitor count" do
      assert {:ok, %{visitors: 0}} = Umami.normalize_active(%{"visitors" => 0})
    end

    test "normalizes a non-negative visitor count" do
      assert {:ok, %{visitors: 27}} = Umami.normalize_active(%{"visitors" => "27"})
    end

    test "rejects an invalid active visitor response" do
      assert {:error, %Error{reason: :unexpected_external_response}} =
               Umami.normalize_active(%{"visitors" => -1})
    end
  end

  describe "visitor location projection" do
    test "normalizes known region variants without assuming every value has a country prefix" do
      rows = [
        %{"name" => "US_CA", "visitors" => 8},
        %{"name" => "BJ", "country" => "CN", "visitors" => 6},
        %{"name" => "CA", "visitors" => 4},
        %{"name" => "unknown region", "visitors" => 3}
      ]

      assert Umami.normalize_visitor_region_rows(rows) == [
               %{code: "US-CA", country_code: "US", visitors: 8},
               %{code: "CN-BJ", country_code: "CN", visitors: 6}
             ]
    end

    test "keeps Top 5 country percentages on the complete recognized-country denominator" do
      countries =
        for {code, visitors} <- [
              {"US", 40},
              {"CN", 25},
              {"DE", 10},
              {"JP", 8},
              {"FR", 7},
              {"BR", 6},
              {"GB", 4}
            ],
            do: %{code: code, visitors: visitors}

      result = Web.visitor_countries(countries, [])

      assert Enum.map(result, & &1.code) == ["US", "CN", "DE", "JP", "FR", "OTHER"]
      assert List.last(result) == %{code: "OTHER", visitors: 10, percentage: 10.0, regions: []}
      assert result |> Enum.map(& &1.percentage) |> Enum.sum() |> Float.round(1) == 100.0
    end

    test "keeps rounded percentages normalized when a tiny Other share rounds below zero" do
      countries = [
        %{code: "US", visitors: 2_006},
        %{code: "CN", visitors: 2_006},
        %{code: "DE", visitors: 2_006},
        %{code: "JP", visitors: 2_006},
        %{code: "FR", visitors: 1_975},
        %{code: "BR", visitors: 1}
      ]

      result = Web.visitor_countries(countries, [])

      assert List.last(result).code == "OTHER"
      assert result |> Enum.map(& &1.percentage) |> Enum.sum() |> Float.round(1) == 100.0
    end

    test "limits regions to Top 10 for allowlisted countries" do
      regions =
        for index <- 1..12,
            do: %{code: "US-#{index}", country_code: "US", visitors: 20 - index}

      [%{regions: selected}] = Web.visitor_countries([%{code: "US", visitors: 100}], regions)

      assert length(selected) == 10
      assert Enum.map(selected, & &1.code) == Enum.map(1..10, &"US-#{&1}")
    end
  end

  describe "Umami weekly sessions projection" do
    test "accepts Umami weekly rows returned as 24 hourly scalar values" do
      rows = [
        List.duplicate(0, 24),
        List.replace_at(List.duplicate(0, 24), 9, 3)
      ]

      result = Umami.normalize_weekly_cells(rows)

      assert length(result) == 48
      assert %{weekday: 1, hour: 9, visitors: 3, visits: 3, views: 0} in result
    end
  end

  describe "Umami section concurrency" do
    test "marks timed out section tasks as timeout errors" do
      {results, errors} =
        Umami.run_sections_for_test(
          [
            summary: fn ->
              {:ok, :summary}
            end,
            slow: fn ->
              Process.sleep(200)
              {:ok, :slow}
            end
          ],
          50
        )

      assert %{summary: :summary} = results
      assert [slow: :timeout] = errors
    end

    test "collects timeout errors from each section independently" do
      {_results, errors} =
        Umami.run_sections_for_test(
          [
            first: fn ->
              Process.sleep(200)
              {:ok, :first}
            end,
            second: fn ->
              Process.sleep(200)
              {:ok, :second}
            end
          ],
          50
        )

      assert [first: :timeout, second: :timeout] = errors
    end
  end

  describe "Umami stats projection" do
    test "uses the provider comparison payload without a second stats query" do
      {current, previous} =
        Umami.normalize_stats(%{
          "pageviews" => 100,
          "visitors" => 40,
          "visits" => 50,
          "bounces" => 10,
          "totaltime" => 600,
          "comparison" => %{
            "pageviews" => 80,
            "visitors" => 30,
            "visits" => 40,
            "bounces" => 8,
            "totaltime" => 400
          }
        })

      assert current == %{pageviews: 100, visitors: 40, visits: 50, bounces: 10, total_time: 600}
      assert previous == %{pageviews: 80, visitors: 30, visits: 40, bounces: 8, total_time: 400}
    end
  end

  describe "summary fallback" do
    test "does not provision an analytics website when Umami is not configured" do
      previous = Application.get_env(:groupher_server, :web_analysis)
      Application.put_env(:groupher_server, :web_analysis, [])

      on_exit(fn ->
        Application.put_env(:groupher_server, :web_analysis, previous)
      end)

      assert {:error, %Error{reason: :not_configured}} =
               Web.provision_community(%Community{slug: "home"})
    end

    test "returns unavailable DTO when Umami is not configured" do
      previous = Application.get_env(:groupher_server, :web_analysis)
      Application.put_env(:groupher_server, :web_analysis, [])

      on_exit(fn ->
        Application.put_env(:groupher_server, :web_analysis, previous)
      end)

      {:ok, result} = Web.summary(%Community{slug: "home"})

      assert result.status == "unavailable"
      assert result.path_scope == "/home"
      assert result.summary.pageviews == 0
      assert result.top_pages == []
    end

    test "returns unavailable overview DTO when Umami is not configured" do
      previous = Application.get_env(:groupher_server, :web_analysis)
      Application.put_env(:groupher_server, :web_analysis, [])

      on_exit(fn ->
        Application.put_env(:groupher_server, :web_analysis, previous)
      end)

      {:ok, result} = Web.trends_overview(%Community{slug: "home"})

      assert result.status == "unavailable"
      assert result.range.bucket == "day"
      assert result.summary.pageviews.value == 0
      assert result.summary.pageviews.previous_value == 0
      assert result.summary.pageviews.change_rate == nil
      assert result.chart.points == []
      assert [%{code: "not_configured", section: "overview"}] = result.errors
    end

    test "returns an explicit unavailable section when Umami is not configured" do
      previous = Application.get_env(:groupher_server, :web_analysis)
      Application.put_env(:groupher_server, :web_analysis, [])

      on_exit(fn ->
        Application.put_env(:groupher_server, :web_analysis, previous)
      end)

      {:ok, pages} = Web.trend_pages(%Community{slug: "home"}, %{}, :path)
      {:ok, traffic} = Web.trend_traffic(%Community{slug: "home"})

      assert %{status: "unavailable", items: [], error: %{section: "pages"}} = pages

      assert %{status: "unavailable", cells: [], timezone: "UTC", error: %{section: "traffic"}} =
               traffic
    end
  end
end
