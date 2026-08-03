defmodule GroupherServer.Test.Query.Analysis do
  @moduledoc false

  use GroupherServer.TestMate

  @summary_query S.Analysis.q(:summary)

  setup do
    {community, _post, _attrs, _user} = mock_article(:post)
    conn = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})
    guest_conn = simu_conn(:guest)
    previous = Application.get_env(:groupher_server, :web_analysis)

    Application.put_env(:groupher_server, :web_analysis, website_id: "test")

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

    test "guest cannot query dashboard web analysis", ~m(guest_conn community)a do
      assert guest_conn
             |> query_error?(
               @summary_query,
               %{community: community.slug, days: 7},
               ecode(:account_login)
             )
    end
  end
end
