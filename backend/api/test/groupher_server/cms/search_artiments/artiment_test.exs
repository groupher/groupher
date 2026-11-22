defmodule GroupherServer.CMS.SearchArtiments.ArtimentTest do
  use ExUnit.Case, async: false

  alias GroupherServer.ErrorCat

  alias GroupherServer.CMS
  alias CMS.Model.Article
  alias CMS.SearchArtiments
  alias CMS.SearchArtiments.{Artiment, Indexer, Query}
  alias Helper.TestFakes.SearchArtiments, as: SearchPlatform
  alias Helper.TestFakes.SearchArtimentsQueue

  setup do
    SearchPlatform.reset()
    SearchArtimentsQueue.reset()
    :ok
  end

  test "builds deterministic Article and Comment refs with Thread namespace" do
    article_id = "550e8400-e29b-41d4-a716-446655440000"

    assert Artiment.article_key(:doc, article_id) ==
             "ARTICLE:DOC:550e8400-e29b-41d4-a716-446655440000"

    assert Artiment.article_key(:doc, article_id, "home") ==
             "ARTICLE:DOC:home:550e8400-e29b-41d4-a716-446655440000"

    assert Artiment.comment_ref(:post, article_id, 18) ==
             "COMMENT:POST:550e8400-e29b-41d4-a716-446655440000:18"
  end

  test "round trips an Article through the platform JSON shape" do
    now = ~U[2026-07-14 10:00:00Z]
    article_id = "550e8400-e29b-41d4-a716-446655440000"
    revision_id = Ecto.UUID.generate()
    ref = Artiment.article_key(:doc, article_id)

    artiment = %Artiment{
      ref: ref,
      type: :article,
      community_ref: "groupher",
      thread: :doc,
      article_id: article_id,
      indexed_snapshot_id: revision_id,
      title: "Search architecture",
      plain_text: "Platform-neutral search content",
      locator: %{community: "groupher", thread: :doc, inner_id: "12"},
      upvotes_count: 3,
      comments_count: 2,
      inserted_at: now,
      updated_at: now,
      schema_version: 1
    }

    assert {:ok, decoded} = artiment |> Artiment.to_platform_map() |> Artiment.from_platform_map()
    assert decoded == artiment
    assert Map.has_key?(Artiment.to_platform_map(artiment), "indexedSnapshotId")
    refute Map.has_key?(Artiment.to_platform_map(artiment), "indexedRevisionId")
    refute Map.has_key?(Artiment.to_platform_map(artiment), "contentHash")
  end

  test "normalizes search scope and keeps pagination separate" do
    assert {:ok, query} =
             Query.new(
               %{
                 text: "  search  ",
                 scope: %{community_ref: "groupher", ignored: true},
                 filters: %{types: [:article], threads: [:doc]}
               },
               %{cursor: %{first: 10}}
             )

    assert query.text == "search"
    assert query.scope == %{community_ref: "groupher"}
    assert query.filters.types == [:article]
    assert query.filters.threads == [:doc]
    assert %GroupherServer.Pagi.Params.Cursor{first: 10} = query.pagi
    assert {:error, _} = Query.new(%{text: "search", page: 1}, nil)
  end

  test "rejects an empty query" do
    assert {:error, %ErrorCat.Error{reason: :custom, details: "search text is required"}} =
             Query.new(%{text: "  "}, nil)
  end

  test "rejects invalid filters instead of silently broadening the query" do
    assert {:error, %ErrorCat.Error{reason: :custom, details: "invalid search filter enum"}} =
             Query.new(%{text: "search", filters: %{threads: [:doc, :invalid]}}, nil)
  end

  test "enqueues deterministic indexing jobs through the configured queue" do
    article_id = Ecto.UUID.generate()
    article = %Article{id: article_id, thread: :post}

    assert {:ok, :pass} = Indexer.enqueue_upsert(article)
    assert {:ok, :pass} = Indexer.enqueue_metrics(article)

    assert SearchArtimentsQueue.jobs() == [
             {:upsert_article, :post, article_id},
             {:sync_article_metrics, :post, article_id}
           ]
  end

  test "partially updates mutable metrics without replacing indexed content" do
    now = ~U[2026-07-14 10:00:00Z]
    updated_at = ~U[2026-07-14 11:00:00Z]
    article_id = Ecto.UUID.generate()
    ref = Artiment.article_key(:post, article_id)

    artiment = %Artiment{
      ref: ref,
      type: :article,
      community_ref: "home",
      thread: :post,
      article_id: article_id,
      indexed_snapshot_id: Ecto.UUID.generate(),
      title: "Stable title",
      plain_text: "Stable body",
      locator: %{community: "home", thread: :post, inner_id: "1"},
      upvotes_count: 1,
      comments_count: 2,
      inserted_at: now,
      updated_at: now,
      content_hash: nil,
      schema_version: 1
    }

    {:ok, :pass} = SearchArtiments.upsert([artiment])

    {:ok, :pass} =
      SearchArtiments.update_metrics([
        {ref, %{upvotes_count: 7, comments_count: 9, updated_at: updated_at}}
      ])

    assert {:ok, result} = SearchArtiments.search(%{text: "Stable"}, nil)
    assert [%{artiment: updated}] = result.entries
    assert updated.upvotes_count == 7
    assert updated.comments_count == 9
    assert updated.updated_at == updated_at
    assert updated.plain_text == "Stable body"
    assert updated.indexed_snapshot_id == artiment.indexed_snapshot_id
  end
end
