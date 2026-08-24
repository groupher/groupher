defmodule GroupherServer.Test.Query.Analysis do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.Accounts.Profiles.ErrorCat

  @overview_query S.Analysis.q(:overview)
  @active_visitors_query S.Analysis.q(:active_visitors)
  @pages_query S.Analysis.q(:pages)
  @sources_query S.Analysis.q(:sources)
  @environment_query S.Analysis.q(:environment)
  @location_query S.Analysis.q(:location)
  @traffic_query S.Analysis.q(:traffic)
  @summary_query S.Analysis.q(:summary)
  @tracking_query S.Analysis.q(:tracking_website_id)
  @visitor_location_map_query S.Analysis.q(:visitor_location_map)

  setup do
    {community, _post, _attrs, _user} = mock_article(:post)
    conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})
    guest_conn = simu_conn(:guest)
    previous = Application.get_env(:groupher_server, :web_analysis)

    Application.put_env(:groupher_server, :web_analysis, [])

    on_exit(fn ->
      Application.put_env(:groupher_server, :web_analysis, previous)
    end)

    {:ok, ~m(conn community guest_conn)a}
  end

  describe "[cms web analysis]" do
    test "community admin can query unavailable summary fallback", ~m(conn community)a do
      result = conn |> gq_query(@summary_query, %{community: community.slug, days: 7})

      assert result["status"] == "unavailable"
      assert result["pathScope"] == "/#{community.slug}"
      assert result["summary"]["pageviews"] == 0
      assert result["topPages"] == []
    end

    test "community admin can query unavailable overview fallback", ~m(conn community)a do
      result = conn |> gq_query(@overview_query, %{community: community.slug, days: 7})

      assert result["status"] == "unavailable"
      assert result["range"]["bucket"] == "day"
      assert result["summary"]["pageviews"]["value"] == 0
      assert result["chart"]["points"] == []
      assert [%{"code" => "not_configured", "section" => "overview"}] = result["errors"]
    end

    test "community admin gets a nullable active visitor result when unavailable",
         ~m(conn community)a do
      result = conn |> gq_query(@active_visitors_query, %{community: community.slug})

      assert is_nil(result)
    end

    test "community admin can query unavailable Trends sections", ~m(conn community)a do
      variables = %{community: community.slug, days: 7}

      pages = conn |> gq_query(@pages_query, Map.put(variables, :dimension, "PATH"))
      sources = conn |> gq_query(@sources_query, Map.put(variables, :dimension, "REFERRER"))

      environment =
        conn |> gq_query(@environment_query, Map.put(variables, :dimension, "BROWSER"))

      location = conn |> gq_query(@location_query, Map.put(variables, :dimension, "COUNTRY"))
      traffic = conn |> gq_query(@traffic_query, variables)

      assert %{"status" => "unavailable", "items" => [], "error" => %{"section" => "pages"}} =
               pages

      assert %{"status" => "unavailable", "items" => [], "error" => %{"section" => "sources"}} =
               sources

      assert %{"status" => "unavailable", "items" => [], "error" => %{"section" => "environment"}} =
               environment

      assert %{"status" => "unavailable", "items" => [], "error" => %{"section" => "location"}} =
               location

      assert %{"status" => "unavailable", "cells" => [], "error" => %{"section" => "traffic"}} =
               traffic
    end

    test "guest cannot query dashboard web analysis", ~m(guest_conn community)a do
      assert guest_conn
             |> query_error?(
               @summary_query,
               %{community: community.slug, days: 7},
               ErrorCat.code(ErrorCat.account_login())
             )
    end

    test "guest cannot query dashboard web analysis overview", ~m(guest_conn community)a do
      assert guest_conn
             |> query_error?(
               @overview_query,
               %{community: community.slug, days: 7},
               ErrorCat.code(ErrorCat.account_login())
             )
    end

    test "guest cannot query active visitors", ~m(guest_conn community)a do
      assert guest_conn
             |> query_error?(
               @active_visitors_query,
               %{community: community.slug},
               ErrorCat.code(ErrorCat.account_login())
             )
    end

    test "guest can query public tracking website id fallback", ~m(guest_conn community)a do
      result = guest_conn |> gq_query(@tracking_query, %{community: community.slug})

      assert is_nil(result)
    end

    test "guest can query a disabled public visitor map without provisioning Umami",
         ~m(guest_conn community)a do
      result =
        guest_conn
        |> gq_query(@visitor_location_map_query, %{community: community.slug})

      assert result == %{
               "status" => "ok",
               "range" => %{"days" => 30},
               "countries" => [],
               "error" => nil
             }
    end
  end
end
