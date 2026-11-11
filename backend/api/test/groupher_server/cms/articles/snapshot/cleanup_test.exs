defmodule GroupherServer.Test.CMS.Articles.Snapshot.CleanupTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    ArticleAssetRef,
    ArticlePublic,
    ArticleSnapshot,
    CommunityAsset,
    CoverEditSnapshot
  }

  test "deletes expired unselected snapshots and only their owned asset references" do
    {community, article, _attrs, actor} = mock_article(:post)
    public = Repo.get!(ArticlePublic, article.id)
    source = Repo.get!(ArticleSnapshot, public.snapshot_id)
    now = DateTime.utc_now(:second)

    cover_snapshot =
      %CoverEditSnapshot{}
      |> CoverEditSnapshot.changeset(%{
        format_version: 1,
        light: %{},
        dark: %{},
        captured_at: DateTime.add(now, -8, :day)
      })
      |> Repo.insert!()

    expired =
      insert_snapshot(source, actor, DateTime.add(now, -8, :day), cover_snapshot.id)

    recent = insert_snapshot(source, actor, DateTime.add(now, -1, :day), nil)

    asset =
      %CommunityAsset{}
      |> CommunityAsset.changeset(%{
        community_id: community.id,
        url: "https://assets.example.test/snapshot-cleanup.png",
        size_bytes: 32,
        asset_type: :image
      })
      |> Repo.insert!()

    asset_ref =
      %ArticleAssetRef{}
      |> ArticleAssetRef.changeset(%{
        community_id: community.id,
        asset_id: asset.id,
        snapshot_id: expired.id,
        usage: :inline
      })
      |> Repo.insert!()

    assert {:ok, 1} = CMS.Articles.cleanup_expired_snapshots(now: now)

    refute Repo.get(ArticleSnapshot, expired.id)
    refute Repo.get(CoverEditSnapshot, cover_snapshot.id)
    refute Repo.get(ArticleAssetRef, asset_ref.id)
    assert Repo.get!(ArticleSnapshot, recent.id)
    assert Repo.get!(ArticleSnapshot, public.snapshot_id)
    assert Repo.get!(CommunityAsset, asset.id)
  end

  test "external RESTRICT references preserve a snapshot and retry after release" do
    {community, article, _attrs, actor} = mock_article(:post)
    public = Repo.get!(ArticlePublic, article.id)
    source = Repo.get!(ArticleSnapshot, public.snapshot_id)
    expired = insert_snapshot(source, actor, DateTime.add(DateTime.utc_now(), -8, :day), nil)

    asset =
      %CommunityAsset{}
      |> CommunityAsset.changeset(%{
        community_id: community.id,
        url: "https://assets.example.test/restricted-snapshot.png",
        size_bytes: 32,
        asset_type: :image
      })
      |> Repo.insert!()

    ref =
      %ArticleAssetRef{}
      |> ArticleAssetRef.changeset(%{
        community_id: community.id,
        asset_id: asset.id,
        snapshot_id: expired.id,
        usage: :inline
      })
      |> Repo.insert!()

    Repo.query!(
      "CREATE TABLE cms.article_snapshot_restrict_test (snapshot_id uuid NOT NULL REFERENCES cms.article_snapshots(id) ON DELETE RESTRICT)"
    )

    Repo.query!(
      "INSERT INTO cms.article_snapshot_restrict_test (snapshot_id) VALUES ($1)",
      [Ecto.UUID.dump!(expired.id)]
    )

    assert {:ok, 0} = CMS.Articles.cleanup_expired_snapshots()
    assert Repo.get!(ArticleSnapshot, expired.id)
    assert Repo.get!(ArticleAssetRef, ref.id)

    Repo.query!("DELETE FROM cms.article_snapshot_restrict_test")

    assert {:ok, 1} = CMS.Articles.cleanup_expired_snapshots()
    refute Repo.get(ArticleSnapshot, expired.id)
    refute Repo.get(ArticleAssetRef, ref.id)
  end

  test "rejects a cleanup batch inside another transaction" do
    assert {:ok, :pass} =
             Repo.transaction(fn ->
               assert {:error, :nested_cleanup_transaction} =
                        CMS.Articles.cleanup_expired_snapshots()

               :pass
             end)
  end

  test "continues past a referenced snapshot when the page is full" do
    {_community, article, _attrs, actor} = mock_article(:post)
    public = Repo.get!(ArticlePublic, article.id)
    source = Repo.get!(ArticleSnapshot, public.snapshot_id)
    now = DateTime.utc_now(:second)
    retained = insert_snapshot(source, actor, DateTime.add(now, -10, :day), nil)
    removable = insert_snapshot(source, actor, DateTime.add(now, -9, :day), nil)

    Repo.query!(
      "CREATE TABLE cms.article_snapshot_page_restrict_test (snapshot_id uuid NOT NULL REFERENCES cms.article_snapshots(id) ON DELETE RESTRICT)"
    )

    Repo.query!(
      "INSERT INTO cms.article_snapshot_page_restrict_test (snapshot_id) VALUES ($1)",
      [Ecto.UUID.dump!(retained.id)]
    )

    assert {:ok, %{deleted_count: 0, next_cursor: cursor}} =
             CMS.Articles.cleanup_expired_snapshots_page(now: now, batch_size: 1)

    assert cursor.id == retained.id

    assert {:ok, %{deleted_count: 1, next_cursor: next_cursor}} =
             CMS.Articles.cleanup_expired_snapshots_page(now: now, batch_size: 1, cursor: cursor)

    assert next_cursor.id == removable.id
    assert Repo.get!(ArticleSnapshot, retained.id)
    refute Repo.get(ArticleSnapshot, removable.id)
    assert Repo.get!(ArticlePublic, article.id).snapshot_id == source.id

    assert {:ok, %{deleted_count: 0, next_cursor: nil}} =
             CMS.Articles.cleanup_expired_snapshots_page(
               now: now,
               batch_size: 1,
               cursor: next_cursor
             )
  end

  test "rejects an invalid page size or cursor" do
    assert {:error, :invalid_snapshot_cleanup_page} =
             CMS.Articles.cleanup_expired_snapshots_page(batch_size: 0)

    assert {:error, :invalid_snapshot_cleanup_page} =
             CMS.Articles.cleanup_expired_snapshots_page(cursor: %{id: "invalid"})
  end

  test "the scheduled worker enqueues the next page past protected snapshots" do
    oban_config =
      :groupher_server
      |> Application.fetch_env!(Oban)
      |> Keyword.merge(testing: :manual, queues: false, plugins: false)

    start_supervised!({Oban, oban_config})

    {_community, article, _attrs, actor} = mock_article(:post)
    public = Repo.get!(ArticlePublic, article.id)
    source = Repo.get!(ArticleSnapshot, public.snapshot_id)
    now = DateTime.utc_now(:second)
    retained = insert_snapshot(source, actor, DateTime.add(now, -11, :day), nil)

    removable =
      for _ <- 1..100, do: insert_snapshot(source, actor, DateTime.add(now, -10, :day), nil)

    Repo.query!(
      "CREATE TABLE cms.article_snapshot_worker_restrict_test (snapshot_id uuid NOT NULL REFERENCES cms.article_snapshots(id) ON DELETE RESTRICT)"
    )

    Repo.query!(
      "INSERT INTO cms.article_snapshot_worker_restrict_test (snapshot_id) VALUES ($1)",
      [Ecto.UUID.dump!(retained.id)]
    )

    worker = GroupherServer.Jobs.ArticleSnapshotCleanup
    assert {:ok, :pass} = worker.perform(%Oban.Job{id: 42, args: %{}})

    [continuation] =
      Repo.all(
        from(job in Oban.Job,
          where: job.worker == "GroupherServer.Jobs.ArticleSnapshotCleanup"
        )
      )

    assert continuation.args["cycle_id"] == "42"
    assert {:ok, :pass} = worker.perform(continuation)
    assert Repo.get!(ArticleSnapshot, retained.id)
    assert Enum.all?(removable, &is_nil(Repo.get(ArticleSnapshot, &1.id)))
  end

  test "the scheduled worker rejects malformed continuation cursors" do
    job = %Oban.Job{
      id: 42,
      args: %{"now" => "invalid", "cursor_at" => "invalid", "cursor_id" => "invalid"}
    }

    assert {:error, :invalid_snapshot_cleanup_cursor} =
             GroupherServer.Jobs.ArticleSnapshotCleanup.perform(job)
  end

  defp insert_snapshot(source, actor, captured_at, cover_edit_snapshot_id) do
    attrs = %{
      article_id: source.article_id,
      source_working_copy_id: Ecto.UUID.generate(),
      source_revision: 1,
      title: source.title,
      digest: source.digest,
      slug: source.slug,
      body_json: source.body_json,
      body_schema_version: source.body_schema_version,
      body_markdown: source.body_markdown,
      body_html: source.body_html,
      body_markdown_toc: source.body_markdown_toc,
      body_plain_text: source.body_plain_text,
      body_thumbnail: source.body_thumbnail,
      body_xml: source.body_xml,
      body_rss: source.body_rss,
      cover_edit_snapshot_id: cover_edit_snapshot_id,
      captured_by_id: actor.id,
      captured_at: captured_at,
      causation_command_id: Ecto.UUID.generate()
    }

    %ArticleSnapshot{}
    |> ArticleSnapshot.changeset(attrs)
    |> Repo.insert!()
  end
end
