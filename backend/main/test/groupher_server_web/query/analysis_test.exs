defmodule GroupherServer.Test.Query.Analysis do
  @moduledoc false

  use GroupherServer.TestMate

  @overview_query S.Analysis.q(:overview)
  @summary_query S.Analysis.q(:summary)
  @tracking_query S.Analysis.q(:tracking_website_id)

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
      assert result["pathScope"] == "/#{community.slug}"
      assert result["range"]["bucket"] == "day"
      assert result["summary"]["pageviews"]["value"] == 0
      assert result["timeseries"]["points"] == []
      assert result["pages"]["path"] == []
      assert result["environment"]["browser"] == []
      assert result["location"]["country"] == []
      assert result["traffic"]["cells"] == []
      assert result["traffic"]["timezone"] == "UTC"
      assert [%{"code" => "not_configured", "section" => "overview"}] = result["errors"]
    end

    test "guest cannot query dashboard web analysis", ~m(guest_conn community)a do
      assert guest_conn
             |> query_error?(
               @summary_query,
               %{community: community.slug, days: 7},
               ecode(:account_login)
             )
    end

    test "guest cannot query dashboard web analysis overview", ~m(guest_conn community)a do
      assert guest_conn
             |> query_error?(
               @overview_query,
               %{community: community.slug, days: 7},
               ecode(:account_login)
             )
    end

    test "guest can query public tracking website id fallback", ~m(guest_conn community)a do
      result = guest_conn |> gq_query(@tracking_query, %{community: community.slug})

      assert is_nil(result)
    end
  end
end
