defmodule GroupherServer.Test.CMS.Articles.ArticleEventConstraintsTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.CMS
  alias CMS.Articles.WorkingCopy.{History, Store, Diff, Snapshotter}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleEvent,
    ArticleHistoryOwner,
    ArticlePublic,
    ArticleSnapshot,
    ArticleWorkingCopy,
    CommunityLifecycle
  }

  test "destroying one community releases only its binding and retains shared Article history" do
    {community, public, _, actor} = GroupherServer.Test.ArticleContentFixture.article(:post)
    clear_events(public.article_id)
    {:ok, other} = mock_community(actor)
    article = Repo.get!(Article, public.article_id)
    snapshot_id = Repo.get!(ArticlePublic, article.id).snapshot_id

    assert {:ok, _} =
             Repo.insert(
               ArticleBinding.changeset(%ArticleBinding{}, %{
                 article_id: article.id,
                 community_id: other.id
               })
             )

    attrs = %{
      actor_type: :user,
      actor_id: actor.id,
      actor_snapshot: %{login: actor.login},
      source: :browser,
      occurred_at: DateTime.utc_now() |> DateTime.truncate(:second),
      operation_ref: Ecto.UUID.generate(),
      operation_index: 0,
      type: :publish,
      article_id: article.id,
      sequence: 1,
      after_snapshot_id: snapshot_id
    }

    assert {:ok, event} = Repo.insert(ArticleEvent.changeset(%ArticleEvent{}, attrs))

    assert {:ok, {:ok, :purged}} =
             Repo.transaction(fn ->
               lifecycle = Repo.get_by!(CommunityLifecycle, community_id: community.id)

               {:ok, lifecycle} =
                 lifecycle |> CommunityLifecycle.changeset(%{state: :destroy}) |> Repo.update()

               CMS.Articles.RetainedHistory.purge_community(lifecycle)
             end)

    assert Repo.get(Article, article.id)
    assert Repo.get(ArticleSnapshot, snapshot_id)
    assert Repo.get(ArticleEvent, event.id)
    refute Repo.get_by(ArticleBinding, article_id: article.id, community_id: community.id)
    assert Repo.get_by(ArticleBinding, article_id: article.id, community_id: other.id)
    assert Repo.get_by(ArticleHistoryOwner, article_id: article.id, community_id: other.id)
  end

  test "create command records one initial version across Receipt replay" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(actor)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "Initial content", body_bag: mock_body_bag(mock_rich_text("initial"))}

    assert {:ok, %{article: article, working_copy: work}} =
             CMS.Articles.create_article(community, :post, attrs, actor, command_id: command_id)

    assert {:ok, _} =
             CMS.Articles.create_article(community, :post, attrs, actor, command_id: command_id)

    event = Repo.get_by!(ArticleEvent, article_id: article.id)
    assert event.type == :create
    assert event.working_copy_id == work.id
    assert event.operation_ref == receipt_operation(command_id)
    assert event.actor_id == actor.id

    assert Repo.aggregate(
             from(event in ArticleEvent, where: event.article_id == ^article.id),
             :count
           ) == 1
  end

  test "create and publish records two events once with distinct operation indexes" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(actor)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "Published Article", body_bag: mock_body_bag(mock_rich_text("body"))}

    assert {:ok, %{article: article, snapshot: snapshot}} =
             CMS.Articles.create_and_publish_article(community, :post, attrs, actor,
               command_id: command_id
             )

    assert {:ok, _} =
             CMS.Articles.create_and_publish_article(community, :post, attrs, actor,
               command_id: command_id
             )

    created =
      Repo.get_by!(ArticleEvent, operation_ref: receipt_operation(command_id), operation_index: 0)

    published =
      Repo.get_by!(ArticleEvent, operation_ref: receipt_operation(command_id), operation_index: 1)

    assert created.type == :create
    assert published.type == :publish
    assert created.article_id == article.id
    assert created.after_snapshot_id == snapshot.id
    assert published.after_snapshot_id == snapshot.id
    assert published.before_snapshot_id == nil
    assert published.sequence == created.sequence + 1

    assert Repo.aggregate(
             from(event in ArticleEvent, where: event.article_id == ^article.id),
             :count
           ) == 2
  end

  test "fork and publish commands record source and replay without duplicate events" do
    {community, public, _, actor} = mock_article(:post)
    clear_events(public.article_id)
    article = Repo.get!(Article, public.article_id)
    before = Repo.get!(ArticlePublic, article.id).snapshot_id
    fork_command = Ecto.UUID.generate()
    scope_id = Ecto.UUID.generate()

    assert {:ok, %{working_copy: fork}} =
             CMS.Articles.fork_snapshot(
               before,
               community,
               :workspace,
               scope_id,
               actor,
               fork_command
             )

    assert {:ok, _} =
             CMS.Articles.fork_snapshot(
               before,
               community,
               :workspace,
               scope_id,
               actor,
               fork_command
             )

    fork_event = Repo.get_by!(ArticleEvent, operation_ref: receipt_operation(fork_command))
    assert fork_event.type == :fork
    assert fork_event.source_snapshot_id == before
    assert fork_event.working_copy_id == fork.id

    publish_command = Ecto.UUID.generate()
    source = %{working_copy_id: fork.id, revision: fork.revision}

    CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
      :last_publish_time,
      actor,
      minutes: -CMS.Gate.RateLimit.Publish.Config.publish_throttle().interval_minutes
    )

    assert {:ok, result} =
             CMS.Articles.publish_article(
               article,
               community,
               source,
               before,
               actor,
               publish_command
             )

    assert {:ok, _} =
             CMS.Articles.publish_article(
               article,
               community,
               source,
               before,
               actor,
               publish_command
             )

    event = Repo.get_by!(ArticleEvent, operation_ref: receipt_operation(publish_command))
    assert event.type == :publish
    assert event.before_snapshot_id == before
    assert event.after_snapshot_id == result.snapshot.id

    assert Repo.aggregate(
             from(event in ArticleEvent, where: event.article_id == ^article.id),
             :count
           ) == 2
  end

  test "ordinary save records changes once across Receipt replay and no-op revisions" do
    {community, public, _, actor} = mock_article(:post)
    clear_events(public.article_id)
    article = Repo.get!(Article, public.article_id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "First edit"}

    assert {:ok, first} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               actor,
               command_id
             )

    assert {:ok, replay} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               actor,
               command_id
             )

    assert replay.revision == first.revision
    event = Repo.get_by!(ArticleEvent, article_id: article.id)
    assert event.operation_ref == receipt_operation(command_id)
    assert event.actor_id == actor.id
    assert event.source == :browser

    assert {:ok, noop} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               first.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert noop.revision == first.revision + 1

    assert Repo.aggregate(
             from(event in ArticleEvent, where: event.article_id == ^article.id),
             :count
           ) == 1

    assert {:ok, _} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Second edit"},
               noop.revision,
               actor,
               Ecto.UUID.generate()
             )

    later = Repo.get_by!(ArticleEvent, article_id: article.id, sequence: 2)
    assert later.previous_event_id == event.id
    assert later.before_revision == noop.revision
  end

  test "unchanged Public selection does not append a publish event" do
    {_, public, _, actor} = GroupherServer.Test.ArticleContentFixture.article(:post)
    clear_events(public.article_id)
    article = Repo.get!(Article, public.article_id)
    snapshot = Repo.get!(ArticlePublic, article.id).snapshot_id
    command_id = Ecto.UUID.generate()

    attrs = %{
      actor_type: :user,
      actor_id: actor.id,
      source: :browser,
      occurred_at: DateTime.utc_now() |> DateTime.truncate(:second),
      operation_ref: command_id,
      operation_index: 0
    }

    assert {:ok, {{:ok, :unchanged}, {:ok, event}}} =
             Repo.transaction(fn ->
               unchanged =
                 History.record_publish_in_transaction(
                   article,
                   snapshot,
                   snapshot,
                   actor,
                   command_id,
                   attrs
                 )

               changed =
                 History.record_publish_in_transaction(
                   article,
                   nil,
                   snapshot,
                   actor,
                   command_id,
                   attrs
                 )

               {unchanged, changed}
             end)

    assert event.type == :publish
    assert event.after_snapshot_id == snapshot

    assert Repo.aggregate(
             from(event in ArticleEvent, where: event.article_id == ^article.id),
             :count
           ) == 1
  end

  test "restore saves a new revision and retains the selected source Snapshot" do
    {community, public, _, actor} = GroupherServer.Test.ArticleContentFixture.article(:post)
    clear_events(public.article_id)
    article = Repo.get!(Article, public.article_id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    source = Repo.get!(ArticlePublic, article.id).snapshot_id
    command_id = Ecto.UUID.generate()

    attrs = %{
      actor_type: :user,
      actor_id: actor.id,
      source: :browser,
      occurred_at: DateTime.utc_now() |> DateTime.truncate(:second),
      operation_ref: command_id,
      operation_index: 0,
      type: :restore,
      source_snapshot_id: source
    }

    assert {:ok, {:ok, _saved}} =
             Repo.transaction(fn ->
               History.record_save_in_transaction(article, work, actor, command_id, attrs, fn ->
                 Store.save_loaded(
                   work,
                   %{title: "Restored content"},
                   actor,
                   work.revision,
                   community.id
                 )
               end)
             end)

    event = Repo.get_by!(ArticleEvent, article_id: article.id)
    assert event.type == :restore
    assert event.source_snapshot_id == source
    assert event.before_snapshot_id != event.after_snapshot_id
  end

  test "a trusted system snapshot has no invented user and the database enforces actor shape" do
    {community, public, _, actor} = GroupherServer.Test.ArticleContentFixture.article(:post)
    clear_events(public.article_id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: public.article_id)
    command_id = Ecto.UUID.generate()

    assert {:ok, {snapshot, event}} =
             Repo.transaction(fn ->
               {:ok, saved} =
                 Store.save_loaded(
                   work,
                   %{title: "System capture"},
                   actor,
                   work.revision,
                   community.id
                 )

               {:ok, snapshot} =
                 Snapshotter.freeze_in_transaction(saved.id, saved.revision, :system, command_id)

               {:ok, event} =
                 History.record_initial_in_transaction(
                   Repo.get!(Article, public.article_id),
                   saved,
                   :system,
                   command_id,
                   %{
                     actor_type: :system,
                     actor_id: nil,
                     source: :system,
                     occurred_at: DateTime.utc_now() |> DateTime.truncate(:second),
                     operation_ref: command_id,
                     operation_index: 0,
                     type: :create
                   }
                 )

               {snapshot, event}
             end)

    assert snapshot.capture_actor_type == :system
    assert snapshot.captured_by_id == nil
    assert event.actor_type == :system
    assert event.actor_id == nil

    assert {:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
             Repo.query(
               """
               INSERT INTO cms.article_snapshots
                 (id, article_id, source_working_copy_id, source_revision, title, digest, slug,
                  body_id, cover_edit_snapshot_id, captured_by_id, capture_actor_type,
                  captured_at, causation_command_id, inserted_at)
               SELECT gen_random_uuid(), article_id, gen_random_uuid(), source_revision, title,
                      digest, slug, body_id, cover_edit_snapshot_id, NULL, 'user',
                      captured_at, causation_command_id, inserted_at
               FROM cms.article_snapshots WHERE id = $1
               """,
               [Ecto.UUID.dump!(snapshot.id)],
               mode: :savepoint
             )

    assert_raise FunctionClauseError, fn ->
      apply(Snapshotter, :freeze_in_transaction, [
        work.id,
        work.revision,
        %{id: actor.id},
        command_id
      ])
    end
  end

  test "created and forked working copies retain their initial snapshot and source" do
    {_, public, _, actor} = GroupherServer.Test.ArticleContentFixture.article(:post)
    clear_events(public.article_id)
    article = Repo.get!(Article, public.article_id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    source_id = Repo.get!(ArticlePublic, article.id).snapshot_id
    command_id = Ecto.UUID.generate()

    attrs = %{
      actor_type: :user,
      actor_id: actor.id,
      source: :browser,
      occurred_at: DateTime.utc_now() |> DateTime.truncate(:second),
      operation_ref: command_id,
      operation_index: 0,
      type: :create
    }

    assert {:ok, {created, forked}} =
             Repo.transaction(fn ->
               {:ok, created} =
                 History.record_initial_in_transaction(article, work, actor, command_id, attrs)

               {:ok, fork} =
                 Snapshotter.fork_snapshot_in_transaction(
                   source_id,
                   %{
                     article_id: article.id,
                     scope_type: :workspace,
                     scope_id: Ecto.UUID.generate()
                   },
                   actor
                 )

               fork_command = Ecto.UUID.generate()

               {:ok, forked} =
                 History.record_initial_in_transaction(
                   article,
                   fork,
                   actor,
                   fork_command,
                   %{attrs | type: :fork, operation_ref: fork_command}
                   |> Map.put(:source_snapshot_id, source_id)
                 )

               {created, forked}
             end)

    assert created.after_snapshot_id == source_id
    assert forked.source_snapshot_id == source_id
    assert forked.after_snapshot_id != source_id
    assert forked.previous_event_id == nil
  end

  test "saving rejects attribution or operation identity that differs from the caller" do
    {_, public, _, actor} = GroupherServer.Test.ArticleContentFixture.article(:post)
    clear_events(public.article_id)
    article = Repo.get!(Article, public.article_id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    attrs = %{actor_type: :user, actor_id: actor.id, operation_ref: Ecto.UUID.generate()}

    assert {:ok, {:error, :history_identity_mismatch}} =
             Repo.transaction(fn ->
               History.record_save_in_transaction(
                 article,
                 work,
                 actor,
                 Ecto.UUID.generate(),
                 attrs,
                 fn ->
                   flunk("save must not be invoked for mismatched identity")
                 end
               )
             end)
  end

  test "missing typed data fails comparison instead of reporting a no-op" do
    {_, public, _, _} = GroupherServer.Test.ArticleContentFixture.article(:post)
    clear_events(public.article_id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: public.article_id)
    snapshot = Repo.get!(ArticlePublic, public.article_id).snapshot_id
    typed = Repo.get!(GroupherServer.CMS.Model.ArticleWorkingCopyPost, work.id)
    assert {:ok, _} = Repo.delete(typed)
    assert {:error, :missing_typed_content} = Diff.compare(snapshot, work.id)
  end

  test "rollback after a saved edit removes both snapshots and the event" do
    {community, public, _, actor} = GroupherServer.Test.ArticleContentFixture.article(:post)
    clear_events(public.article_id)
    article = Repo.get!(Article, public.article_id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    snapshot_count = Repo.aggregate(ArticleSnapshot, :count)

    attrs = %{
      actor_type: :user,
      actor_id: actor.id,
      actor_snapshot: %{login: actor.login},
      source: :browser,
      occurred_at: DateTime.utc_now() |> DateTime.truncate(:second),
      operation_ref: Ecto.UUID.generate(),
      operation_index: 0
    }

    assert {:error, :later_failure} =
             Repo.transaction(fn ->
               assert {:ok, _} =
                        History.record_save_in_transaction(
                          article,
                          work,
                          actor,
                          attrs.operation_ref,
                          attrs,
                          fn ->
                            Store.save_loaded(
                              work,
                              %{title: "Rolled back"},
                              actor,
                              work.revision,
                              community.id
                            )
                          end
                        )

               Repo.rollback(:later_failure)
             end)

    assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision
    assert Repo.aggregate(ArticleSnapshot, :count) == snapshot_count

    assert Repo.aggregate(
             from(event in ArticleEvent, where: event.article_id == ^article.id),
             :count
           ) == 0
  end

  test "the transaction owner rolls back a failed event insert and the save" do
    {community, public, _, actor} = GroupherServer.Test.ArticleContentFixture.article(:post)
    clear_events(public.article_id)
    article = Repo.get!(Article, public.article_id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    count = Repo.aggregate(ArticleSnapshot, :count)
    command_id = Ecto.UUID.generate()

    attrs = %{
      actor_type: :user,
      actor_id: actor.id,
      actor_snapshot: %{login: actor.login},
      occurred_at: DateTime.utc_now() |> DateTime.truncate(:second),
      operation_ref: command_id,
      operation_index: 0
    }

    assert {:error, %Ecto.Changeset{}} =
             Repo.transaction(fn ->
               case History.record_save_in_transaction(
                      article,
                      work,
                      actor,
                      command_id,
                      attrs,
                      fn ->
                        Store.save_loaded(
                          work,
                          %{title: "Rejected"},
                          actor,
                          work.revision,
                          community.id
                        )
                      end
                    ) do
                 {:ok, result} -> result
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision
    assert Repo.aggregate(ArticleSnapshot, :count) == count

    assert Repo.aggregate(
             from(event in ArticleEvent, where: event.article_id == ^article.id),
             :count
           ) == 0
  end

  test "a saved edit freezes both versions and a no-op does not create an event" do
    {community, public, _, actor} = GroupherServer.Test.ArticleContentFixture.article(:post)
    clear_events(public.article_id)
    article = Repo.get!(Article, public.article_id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)

    attrs = %{
      actor_type: :user,
      actor_id: actor.id,
      actor_snapshot: %{login: actor.login},
      source: :browser,
      occurred_at: DateTime.utc_now() |> DateTime.truncate(:second),
      operation_ref: Ecto.UUID.generate(),
      operation_index: 0
    }

    assert {:ok, {:ok, saved}} =
             Repo.transaction(fn ->
               History.record_save_in_transaction(
                 article,
                 work,
                 actor,
                 attrs.operation_ref,
                 attrs,
                 fn ->
                   Store.save_loaded(
                     work,
                     %{title: "Changed title"},
                     actor,
                     work.revision,
                     community.id
                   )
                 end
               )
             end)

    event = Repo.get_by!(ArticleEvent, article_id: article.id)
    assert event.before_revision == work.revision
    assert event.after_revision == saved.revision
    assert event.before_snapshot_id != event.after_snapshot_id

    assert {:ok, {:ok, next}} =
             Repo.transaction(fn ->
               History.record_save_in_transaction(
                 article,
                 saved,
                 actor,
                 attrs.operation_ref,
                 attrs,
                 fn ->
                   Store.save_loaded(
                     saved,
                     %{title: "Changed title"},
                     actor,
                     saved.revision,
                     community.id
                   )
                 end
               )
             end)

    assert next.revision == saved.revision + 1

    assert Repo.aggregate(
             from(event in ArticleEvent, where: event.article_id == ^article.id),
             :count
           ) == 1
  end

  test "event sequence follows the locked Article and publish does not interrupt the content chain" do
    {_, public, _, actor} = GroupherServer.Test.ArticleContentFixture.article(:post)
    clear_events(public.article_id)
    article = Repo.get!(Article, public.article_id)
    snapshot_id = Repo.get!(ArticlePublic, article.id).snapshot_id
    work_id = Ecto.UUID.generate()
    operation_ref = Ecto.UUID.generate()

    attrs = %{
      actor_type: :user,
      actor_id: actor.id,
      actor_snapshot: %{login: actor.login},
      source: :browser,
      occurred_at: DateTime.utc_now() |> DateTime.truncate(:second),
      operation_ref: operation_ref,
      operation_index: 0,
      type: :create,
      working_copy_id: work_id,
      after_revision: 1,
      after_snapshot_id: snapshot_id
    }

    assert {:ok, {first, published, edited}} =
             Repo.transaction(fn ->
               {:ok, first} = History.append_in_transaction(article, attrs)

               {:ok, published} =
                 History.append_in_transaction(article, %{
                   attrs
                   | type: :publish,
                     operation_index: 1
                 })

               {:ok, edited} =
                 History.append_in_transaction(
                   article,
                   Map.merge(attrs, %{
                     type: :edit,
                     operation_index: 2,
                     before_revision: 1,
                     after_revision: 2,
                     before_snapshot_id: snapshot_id
                   })
                 )

               {first, published, edited}
             end)

    assert {first.sequence, published.sequence, edited.sequence} == {1, 2, 3}
    assert published.previous_event_id == nil
    assert edited.previous_event_id == first.id

    assert {:error, %Postgrex.Error{postgres: %{code: :object_not_in_prerequisite_state}}} =
             Repo.query(
               "UPDATE cms.article_events SET sequence = 4 WHERE id = $1",
               [Ecto.UUID.dump!(first.id)],
               mode: :savepoint
             )

    assert {:ok, %{num_rows: 3}} =
             Repo.query(
               "DELETE FROM cms.article_events WHERE article_id = $1",
               [Ecto.UUID.dump!(article.id)],
               mode: :savepoint
             )
  end

  test "event identities, actor shape and snapshot ownership are enforced by the database" do
    {_, public, _, actor} = GroupherServer.Test.ArticleContentFixture.article(:post)
    clear_events(public.article_id)
    {_, other_public, _, _} = GroupherServer.Test.ArticleContentFixture.article(:post)
    clear_events(other_public.article_id)
    snapshot_id = Repo.get!(ArticlePublic, public.article_id).snapshot_id
    other_snapshot_id = Repo.get!(ArticlePublic, other_public.article_id).snapshot_id

    attrs = %{
      article_id: public.article_id,
      sequence: 1,
      actor_type: :user,
      actor_id: actor.id,
      actor_snapshot: %{login: actor.login},
      source: :browser,
      occurred_at: DateTime.utc_now() |> DateTime.truncate(:second),
      operation_ref: Ecto.UUID.generate(),
      operation_index: 0,
      type: :publish,
      after_snapshot_id: snapshot_id
    }

    assert {:ok, _} =
             Repo.insert(ArticleEvent.changeset(%ArticleEvent{}, attrs), mode: :savepoint)

    assert {:error, _} =
             Repo.insert(ArticleEvent.changeset(%ArticleEvent{}, attrs), mode: :savepoint)

    assert {:error, _} =
             Repo.insert(
               ArticleEvent.changeset(%ArticleEvent{}, %{
                 attrs
                 | sequence: 2,
                   operation_ref: Ecto.UUID.generate(),
                   after_snapshot_id: other_snapshot_id
               }),
               mode: :savepoint
             )

    assert {:error, _} =
             Repo.insert(
               ArticleEvent.changeset(%ArticleEvent{}, %{
                 attrs
                 | sequence: 2,
                   operation_ref: Ecto.UUID.generate(),
                   actor_type: :system
               }),
               mode: :savepoint
             )

    assert {:error, _} =
             Repo.insert(
               ArticleEvent.changeset(
                 %ArticleEvent{},
                 Map.merge(attrs, %{
                   sequence: 2,
                   operation_ref: Ecto.UUID.generate(),
                   type: :edit,
                   working_copy_id: Ecto.UUID.generate(),
                   before_revision: 1,
                   before_snapshot_id: snapshot_id
                 })
               ),
               mode: :savepoint
             )
  end

  defp clear_events(article_id) do
    Repo.query!("DELETE FROM cms.article_events WHERE article_id = $1", [
      Ecto.UUID.dump!(article_id)
    ])
  end

  defp receipt_operation(command_id) do
    Repo.get_by!(CMS.Model.CommandReceipt, command_id: command_id).operation_ref
  end
end
