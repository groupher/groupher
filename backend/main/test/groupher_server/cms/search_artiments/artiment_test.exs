defmodule GroupherServer.CMS.SearchArtiments.ArtimentTest do
  use ExUnit.Case, async: false

  alias GroupherServer.CMS.Model.Embeds.ArticleMeta
  alias GroupherServer.CMS.Model.Post
  alias GroupherServer.CMS.SearchArtiments
  alias GroupherServer.CMS.SearchArtiments.{Artiment, Indexer, Query}
  alias Helper.TestFakes.SearchArtiments, as: SearchPlatform
  alias Helper.TestFakes.SearchArtimentsQueue

  setup do
    SearchPlatform.reset()
    SearchArtimentsQueue.reset()
    :ok
  end

  test "builds deterministic Article and Comment refs with Thread namespace" do
    article_hash_id = "550e8400-e29b-41d4-a716-446655440000"

    assert Artiment.article_ref(:doc, article_hash_id) ==
             "ARTICLE:DOC:550e8400-e29b-41d4-a716-446655440000"

    assert Artiment.comment_ref(:post, article_hash_id, 18) ==
             "COMMENT:POST:550e8400-e29b-41d4-a716-446655440000:18"
  end

  test "round trips an Article through the platform JSON shape" do
    now = ~U[2026-07-14 10:00:00Z]
    ref = Artiment.article_ref(:doc, "550e8400-e29b-41d4-a716-446655440000")

    artiment = %Artiment{
      ref: ref,
      type: :article,
      community_ref: "groupher",
      thread: :doc,
      article_ref: ref,
      title: "Search architecture",
      plain_text: "Platform-neutral search content",
      locator: %{community: "groupher", thread: :doc, inner_id: "12"},
      upvotes_count: 3,
      comments_count: 2,
      inserted_at: now,
      updated_at: now,
      content_hash: "content-hash",
      schema_version: 1
    }

    assert {:ok, decoded} = artiment |> Artiment.to_platform_map() |> Artiment.from_platform_map()
    assert decoded == artiment
  end

  test "normalizes query pagination, filters and scope" do
    assert {:ok, query} =
             Query.new(%{
               text: "  search  ",
               scope: %{community_ref: "groupher", ignored: true},
               filters: %{types: [:article], threads: [:doc]},
               page: -1,
               size: 1_000
             })

    assert query.text == "search"
    assert query.scope == %{community_ref: "groupher"}
    assert query.filters.types == [:article]
    assert query.filters.threads == [:doc]
    assert query.page == 1
    assert query.size == 100
  end

  test "rejects an empty query" do
    assert {:error,
            %GroupherServer.ErrorCat.Error{reason: :custom, details: "search text is required"}} =
             Query.new(%{text: "  "})
  end

  test "rejects invalid filters instead of silently broadening the query" do
    assert {:error,
            %GroupherServer.ErrorCat.Error{reason: :custom, details: "invalid search filter enum"}} =
             Query.new(%{text: "search", filters: %{threads: [:doc, :invalid]}})
  end

  test "enqueues deterministic indexing jobs through the configured queue" do
    article = %Post{
      id: 42,
      article_hash_id: Ecto.UUID.generate(),
      meta: %ArticleMeta{thread: :post}
    }

    assert {:ok, :pass} = Indexer.enqueue_upsert(article)
    assert {:ok, :pass} = Indexer.enqueue_metrics(article)

    assert SearchArtimentsQueue.jobs() == [
             {:upsert_article, :post, 42},
             {:sync_article_metrics, :post, 42}
           ]
  end

  test "partially updates mutable metrics without replacing indexed content" do
    now = ~U[2026-07-14 10:00:00Z]
    updated_at = ~U[2026-07-14 11:00:00Z]
    ref = Artiment.article_ref(:post, Ecto.UUID.generate())

    artiment = %Artiment{
      ref: ref,
      type: :article,
      community_ref: "home",
      thread: :post,
      article_ref: ref,
      title: "Stable title",
      plain_text: "Stable body",
      locator: %{community: "home", thread: :post, inner_id: "1"},
      upvotes_count: 1,
      comments_count: 2,
      inserted_at: now,
      updated_at: now,
      content_hash: "stable-hash",
      schema_version: 1
    }

    :ok = SearchArtiments.upsert([artiment])

    :ok =
      SearchArtiments.update_metrics([
        {ref, %{upvotes_count: 7, comments_count: 9, updated_at: updated_at}}
      ])

    assert {:ok, result} = SearchArtiments.search(%{text: "Stable"})
    assert [%{artiment: updated}] = result.entries
    assert updated.upvotes_count == 7
    assert updated.comments_count == 9
    assert updated.updated_at == updated_at
    assert updated.plain_text == "Stable body"
    assert updated.content_hash == "stable-hash"
  end
end
