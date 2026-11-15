defmodule GroupherServer.Test.CMS.Articles.BodyStorageTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Articles.Body
  alias CMS.Articles.WorkingCopy.Snapshotter
  alias CMS.Model.{Article, ArticleBody, ArticlePublic, ArticleSnapshot, ArticleWorkingCopy}

  setup do
    {community, public, _, actor} = GroupherServer.Test.ArticleContentFixture.article(:post)
    article = Repo.get!(Article, public.article_id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    snapshot = Repo.get!(ArticleSnapshot, Repo.get!(ArticlePublic, article.id).snapshot_id)
    %{community: community, article: article, actor: actor, work: work, snapshot: snapshot}
  end

  test "freeze and fork own independent complete bodies; deleting work preserves history", ctx do
    %{work: work, snapshot: snapshot, actor: actor, article: article, community: community} = ctx
    assert work.body_id != snapshot.body_id
    assert Body.document(work) == Body.document(snapshot)
    assert Repo.get!(ArticleBody, work.body_id).type == :working_copy
    assert Repo.get!(ArticleBody, snapshot.body_id).type == :snapshot
    count = Repo.aggregate(ArticleBody, :count)

    assert {:ok, ^snapshot} =
             Repo.transaction(fn ->
               {:ok, same} =
                 Snapshotter.freeze_in_transaction(
                   work.id,
                   work.revision,
                   actor,
                   Ecto.UUID.generate()
                 )

               same
             end)

    assert Repo.aggregate(ArticleBody, :count) == count

    assert {:ok, clone} =
             Repo.transaction(fn ->
               {:ok, cloned} =
                 Snapshotter.fork_snapshot_in_transaction(
                   snapshot.id,
                   %{scope_type: :workspace, scope_id: Ecto.UUID.generate()},
                   actor
                 )

               cloned
             end)

    assert clone.body_id not in [work.body_id, snapshot.body_id]
    assert Body.document(clone) == Body.document(snapshot)

    assert {:ok, _} =
             CMS.Articles.delete_working_copy(
               article,
               community,
               clone.id,
               actor,
               Ecto.UUID.generate()
             )

    refute Repo.get(ArticleBody, clone.body_id)
    assert Repo.get!(ArticleBody, snapshot.body_id)
    assert Repo.get!(ArticleBody, work.body_id)
  end

  test "save changes only the mutable body and revision; stale saves and malformed bodies leave it intact",
       ctx do
    %{work: work, snapshot: snapshot, article: article, community: community, actor: actor} = ctx
    original = Body.document(snapshot)

    bag =
      GroupherServer.Support.Factory.mock_body_bag(
        GroupherServer.Support.Factory.mock_rich_text("new content")
      )

    count = Repo.aggregate(ArticleBody, :count)
    command_id = Ecto.UUID.generate()

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{body_bag: bag},
               work.revision,
               actor,
               command_id
             )

    assert saved.body_id == work.body_id
    assert saved.revision == work.revision + 1
    assert Body.document(saved).json == bag.json
    assert Body.document(saved).html == bag.html
    assert Body.document(snapshot) == original
    assert Repo.aggregate(ArticleBody, :count) == count

    assert {:ok, replayed} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{body_bag: bag},
               work.revision,
               actor,
               command_id
             )

    assert replayed.revision == saved.revision

    assert {:error, _} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "stale"},
               work.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert {:error, _} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{body_bag: %{json: "invalid"}},
               saved.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert Body.document(Repo.get!(ArticleWorkingCopy, work.id)) == Body.document(saved)
    assert Repo.get!(ArticleWorkingCopy, work.id).revision == saved.revision

    assert {:ok, :pass} =
             Repo.transaction(fn ->
               {:ok, frozen} =
                 Snapshotter.freeze_in_transaction(
                   work.id,
                   saved.revision,
                   actor,
                   Ecto.UUID.generate()
                 )

               {:ok, clone} =
                 Snapshotter.fork_snapshot_in_transaction(
                   frozen.id,
                   %{scope_type: :workspace, scope_id: Ecto.UUID.generate()},
                   actor
                 )

               {:ok, _} =
                 CMS.Articles.WorkingCopy.Store.save_loaded(
                   clone,
                   %{
                     body_bag:
                       GroupherServer.Support.Factory.mock_body_bag(
                         GroupherServer.Support.Factory.mock_rich_text("fork edit")
                       )
                   },
                   actor,
                   clone.revision,
                   community.id
                 )

               assert Body.document(frozen) == Body.document(saved)

               assert Body.document(Repo.get!(ArticleWorkingCopy, work.id)) ==
                        Body.document(saved)

               assert Body.document(Repo.get!(ArticleWorkingCopy, clone.id)) !=
                        Body.document(frozen)

               :pass
             end)
  end

  test "database rejects snapshot updates, owner changes and shared body IDs", %{
    work: work,
    snapshot: snapshot
  } do
    assert_sql_error(
      "UPDATE cms.article_bodies SET html = 'tampered' WHERE id = $1",
      [snapshot.body_id],
      :object_not_in_prerequisite_state
    )

    assert_sql_error(
      "UPDATE cms.article_bodies SET type = 'snapshot' WHERE id = $1",
      [work.body_id],
      :object_not_in_prerequisite_state
    )

    assert_sql_error(
      "UPDATE cms.article_working_copies SET body_id = $1 WHERE id = $2",
      [snapshot.body_id, work.id],
      :object_not_in_prerequisite_state
    )

    assert_sql_error(
      "DELETE FROM cms.article_bodies WHERE id = $1",
      [snapshot.body_id],
      :foreign_key_violation
    )

    assert_sql_error(
      "UPDATE cms.article_bodies SET schema_version = 0 WHERE id = $1",
      [work.body_id],
      :check_violation
    )

    assert_sql_error(
      "UPDATE cms.article_working_copies SET revision = 0 WHERE id = $1",
      [work.id],
      :check_violation
    )

    original_article = Repo.get!(Article, work.article_id)

    other =
      %Article{}
      |> Article.changeset(%{thread: :post, author_id: original_article.author_id})
      |> Repo.insert!()

    foreign_body =
      %ArticleBody{}
      |> ArticleBody.changeset(
        Map.merge(Body.document(work), %{article_id: other.id, type: :working_copy})
      )
      |> Repo.insert!()

    assert_sql_error(
      """
      INSERT INTO cms.article_working_copies
        (id, article_id, body_id, scope_type, scope_id, revision, title, digest, created_by_id, updated_by_id, inserted_at, updated_at)
      SELECT gen_random_uuid(), article_id, $1, 'workspace', gen_random_uuid(), 1, title, digest,
        created_by_id, updated_by_id, inserted_at, updated_at
      FROM cms.article_working_copies WHERE id = $2
      """,
      [foreign_body.id, work.id],
      :foreign_key_violation
    )

    # INSERT bypasses the owner UPDATE guard: the composite FK must reject wrong type.
    assert_sql_error(
      """
      INSERT INTO cms.article_working_copies
        (id, article_id, body_id, scope_type, scope_id, revision, title, digest, created_by_id, updated_by_id, inserted_at, updated_at)
      SELECT gen_random_uuid(), article_id, $1, 'workspace', gen_random_uuid(), 1, title, digest,
        created_by_id, updated_by_id, inserted_at, updated_at
      FROM cms.article_working_copies WHERE id = $2
      """,
      [snapshot.body_id, work.id],
      :foreign_key_violation
    )

    assert_sql_error(
      """
      INSERT INTO cms.article_working_copies
        (id, article_id, body_id, scope_type, scope_id, revision, title, digest, created_by_id, updated_by_id, inserted_at, updated_at)
      SELECT gen_random_uuid(), article_id, body_id, 'workspace', gen_random_uuid(), 1, title, digest,
        created_by_id, updated_by_id, inserted_at, updated_at
      FROM cms.article_working_copies WHERE id = $1
      """,
      [work.id],
      :unique_violation
    )
  end

  test "a late freeze failure rolls its new body back", %{work: work, actor: actor} do
    # Advance the revision so this is a new Freeze, then fail after its inserts.
    Repo.update_all(from(w in ArticleWorkingCopy, where: w.id == ^work.id), inc: [revision: 1])
    count = Repo.aggregate(ArticleBody, :count)

    assert {:error, :late_failure} =
             Repo.transaction(fn ->
               {:ok, _} =
                 Snapshotter.freeze_in_transaction(
                   work.id,
                   work.revision + 1,
                   actor,
                   Ecto.UUID.generate()
                 )

               Repo.rollback(:late_failure)
             end)

    assert Repo.aggregate(ArticleBody, :count) == count

    refute Repo.get_by(ArticleSnapshot,
             source_working_copy_id: work.id,
             source_revision: work.revision + 1
           )
  end

  test "Press consumes the selected Snapshot body", ctx do
    %{article: article, community: community, actor: actor, snapshot: snapshot} = ctx

    assert {:ok, _} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 5, feed_threads: [:post]},
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, %{items: [item]}} = CMS.Press.thread_rss_feed(community, :post)
    assert item.item_id == article.id
    assert item.html == Body.document(snapshot).html
  end

  test "cutover refuses a nonempty owner table without changing existing content", %{work: work} do
    migration = GroupherServer.Repo.Migrations.ExtractArticleBodies

    unless Code.ensure_loaded?(migration) do
      Code.require_file("priv/repo/migrations/20261112130000_extract_article_bodies.exs")
    end

    before = Body.document(work)

    assert_raise Postgrex.Error, ~r/requires empty content owners/, fn ->
      Repo.transaction(
        fn ->
          Ecto.Migration.Runner.run(
            Repo,
            Repo.config(),
            20_261_112_130_000,
            migration,
            :forward,
            :up,
            :up,
            log: false
          )
        end,
        mode: :savepoint
      )
    end

    assert Body.document(work) == before
  end

  defp assert_sql_error(sql, ids, code) do
    error =
      assert_raise Postgrex.Error, fn ->
        Repo.query!(sql, Enum.map(ids, &Ecto.UUID.dump!/1), mode: :savepoint)
      end

    assert error.postgres.code == code
  end
end
