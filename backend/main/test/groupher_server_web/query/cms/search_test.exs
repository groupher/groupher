defmodule GroupherServer.Test.Query.CMS.Search do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS.SearchArtiments.Artiment
  alias Helper.TestFakes.SearchArtiments

  defp create_community!(user, attrs) do
    community_attrs = mock_attrs(:community, attrs)
    {:ok, community} = CMS.Communities.create(community_attrs, user)
    community
  end

  setup do
    guest_conn = simu_conn(:guest)
    {:ok, user} = db_insert(:user)
    _community = create_community!(user, %{title: "react"})
    _community = create_community!(user, %{title: "php"})
    _community = create_community!(user, %{title: "每日妹子"})
    _community = create_community!(user, %{title: "javascript"})
    _community = create_community!(user, %{title: "java"})

    SearchArtiments.reset()

    Enum.with_index(["react", "php", "每日妹子", "javascript", "java"], 1)
    |> Enum.each(fn {title, inner_id} ->
      :ok = SearchArtiments.upsert([search_article(title, inner_id)])
    end)

    on_exit(&SearchArtiments.reset/0)

    {:ok, ~m(guest_conn user)a}
  end

  describe "[cms search artiments query]" do
    test "search Article by full text returns unified hits", ~m(guest_conn)a do
      variables = %{query: %{text: "react"}}
      results = guest_conn |> gq_query(S.Article.q(:search_artiments, :post), variables)

      assert results["totalCount"] == 1
      assert results["entries"] |> Enum.any?(&(&1["artiment"]["title"] == "react"))
      assert hd(results["entries"])["artiment"]["type"] == "ARTICLE"

      variables = %{query: %{text: "java", filters: %{threads: ["POST"]}}}
      results = guest_conn |> gq_query(S.Article.q(:search_artiments, :post), variables)

      assert results["totalCount"] == 2
      assert results["entries"] |> Enum.any?(&(&1["artiment"]["title"] == "java"))
      assert results["entries"] |> Enum.any?(&(&1["artiment"]["title"] == "javascript"))
    end

    test "search non-existent content returns empty pagination", ~m(guest_conn)a do
      variables = %{query: %{text: "non-exist"}}
      results = guest_conn |> gq_query(S.Article.q(:search_artiments, :post), variables)

      assert results["totalCount"] == 0
      assert results["entries"] == []
    end
  end

  describe "[cms search community query]" do
    test "search community by full title should valid paged communities", ~m(guest_conn)a do
      variables = %{title: "react"}
      results = guest_conn |> gq_query(S.Community.q(:search_communities), variables)

      assert results["totalCount"] == 1
      assert results["entries"] |> Enum.any?(&(&1["title"] == "react"))

      variables = %{title: "java"}
      results = guest_conn |> gq_query(S.Community.q(:search_communities), variables)

      assert results["totalCount"] == 2
      assert results["entries"] |> Enum.any?(&(&1["title"] == "java"))
      assert results["entries"] |> Enum.any?(&(&1["title"] == "javascript"))
    end

    test "can search community with category", ~m(guest_conn user)a do
      community = create_community!(user, %{title: "cool-pl"})
      {:ok, category} = db_insert(:category, %{slug: "pl"})

      {:ok, _} = CMS.Communities.set_category(community, category)

      variables = %{title: "cool-pl", category: "pl"}
      results = guest_conn |> gq_query(S.Community.q(:search_communities), variables)

      assert results["totalCount"] == 1
      assert results["entries"] |> Enum.any?(&(&1["title"] == "cool-pl"))
    end

    test "search non-exist community should get empty pagi data", ~m(guest_conn)a do
      variables = %{title: "non-exist"}
      results = guest_conn |> gq_query(S.Community.q(:search_communities), variables)

      assert results["totalCount"] == 0
      assert results["entries"] == []
    end
  end

  defp search_article(title, inner_id) do
    now = DateTime.utc_now(:second)
    article_hash_id = Ecto.UUID.generate()
    ref = Artiment.article_ref(:post, article_hash_id)

    %Artiment{
      ref: ref,
      type: :article,
      community_ref: "home",
      thread: :post,
      article_ref: ref,
      title: title,
      plain_text: "#{title} body",
      locator: %{community: "home", thread: :post, inner_id: to_string(inner_id)},
      upvotes_count: 0,
      comments_count: 0,
      inserted_at: now,
      updated_at: now,
      content_hash: "hash-#{inner_id}",
      schema_version: 1
    }
  end
end
