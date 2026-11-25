defmodule GroupherServer.Test.CMS.DocTree.ReleaseEffectsTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{Accounts, Activity, CMS, Repo}

  alias CMS.DocTree.Commands.{
    CreateWorkspaceNode,
    DeleteWorkspaceNode,
    Enqueue,
    ReleaseQueue,
    RestoreWorkspaceNode
  }

  alias CMS.DocTree.Publish.Queue

  alias CMS.Model.{
    CommandReceipt,
    CommunityAdmin,
    DocsRelease,
    DocsQueueTreeChange
  }

  alias CMS.Outbox.Event

  @rollback_schemas [
    CMS.Model.Article,
    CMS.Model.ArticleBinding,
    CMS.Model.ArticlePublic,
    CMS.Model.ArticleSnapshot,
    CMS.Model.ArticleBody,
    CMS.Model.ArticlePublicBody,
    CMS.Model.ArticleStats,
    CMS.Model.ArticleEmotionCount,
    CMS.Model.ArtimentReview,
    CMS.Model.Mentions.Endpoint,
    CMS.Model.Mentions.Edge,
    CMS.Model.Mentions.GraphState,
    CMS.Model.ArticleWorkingCopy,
    CMS.Model.ArticleLifecycle,
    CMS.Model.ArticleEvent,
    CMS.Model.ArticleHistoryOwner,
    CMS.Model.DocsTreeNode,
    CMS.Model.DocsPublishQueue,
    CMS.Model.DocsQueueArticle,
    CMS.Model.DocsQueueTreeChange,
    CMS.Model.DocsQueueTreeContributor,
    CMS.Model.DocsQueueArticleContributor,
    CMS.Model.DocsPostPublishConflict,
    CMS.Model.DocsRelease,
    CMS.Model.DocsReleaseArticle,
    CMS.Model.DocsReleaseTreeSnapshot,
    CMS.Model.CommandReceipt,
    CMS.Model.Community,
    Accounts.Model.User,
    Activity.Model.DocLog,
    Activity.Model.DocTreeLog,
    Event,
    CMS.Outbox.Retry,
    Oban.Job
  ]

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    [[database]] = Repo.query!("SELECT current_database()").rows

    assert String.contains?(database, "test") or
             String.starts_with?(database, "groupher_identity_")

    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)
    on_exit(fn -> Application.put_env(:groupher_server, :env, previous) end)
    :ok
  end

  test "Docs directory release and Outbox intent roll back together under one operation" do
    {:ok, actor} =
      db_insert(:user, %{
        login: "release-" <> Base.url_encode64(:crypto.strong_rand_bytes(9), padding: false)
      })

    {:ok, community} = mock_community(actor)
    lord = Repo.get_by!(CommunityAdmin, user_id: actor.id, community_id: community.id)
    Repo.update!(Ecto.Changeset.change(lord, is_lord: true))
    operation_ref = Ecto.UUID.generate()

    target = [
      %{
        node_id: "release-tab",
        type: :tab,
        parent_node_id: nil,
        index: 0,
        title: "Docs",
        href: nil,
        doc_id: nil,
        marker: nil,
        badge: nil,
        hidden: false
      }
    ]

    assert {:ok, {_queue, _reconciled}} =
             Repo.transaction(fn ->
               {:ok, queue} = Queue.lock_or_create(community)

               {:ok, reconciled} =
                 Queue.reconcile_tree(
                   community,
                   queue,
                   queue.queue_revision,
                   [],
                   target,
                   actor,
                   operation_ref
                 )

               {queue, reconciled}
             end)

    {:ok, queued} = Queue.read(community)
    assert Repo.exists?(from(change in DocsQueueTreeChange, where: change.queue_id == ^queued.id))

    command_id = Ecto.UUID.generate()
    resource_id = Integer.to_string(community.id)

    existing_release_ids =
      Repo.all(
        from(release in DocsRelease,
          where: release.community_id == ^community.id,
          select: release.id
        )
      )

    existing_event_ids =
      Repo.all(
        from(event in Event,
          where: event.resource_type == "community" and event.resource_id == ^resource_id,
          select: event.id
        )
      )

    assert {:error, :rollback_release} =
             Repo.transaction(fn ->
               assert {:ok, result} =
                        ReleaseQueue.execute(community, queued.queue_revision, actor, command_id)

               release = Repo.get!(DocsRelease, result.release_id)
               assert release.sealed
               assert release.community_id == community.id

               receipt = Repo.get_by!(CommandReceipt, command_id: command_id)

               assert [event] =
                        Repo.all(
                          from(event in Event,
                            where:
                              event.operation_ref == ^receipt.operation_ref and
                                event.event == "doc_tree.changed" and
                                event.resource_type == "community" and
                                event.resource_id == ^resource_id
                          )
                        )

               assert event.operation_ref == receipt.operation_ref

               Repo.rollback(:rollback_release)
             end)

    assert Repo.all(
             from(release in DocsRelease,
               where: release.community_id == ^community.id,
               select: release.id
             )
           ) == existing_release_ids

    refute Repo.get_by(CommandReceipt, command_id: command_id)

    assert Repo.all(
             from(event in Event,
               where: event.resource_type == "community" and event.resource_id == ^resource_id,
               select: event.id
             )
           ) == existing_event_ids
  end

  for action <- [:publication, :removal],
      phase <- [:release_seal, :effect_insert, :wakeup, :queue_consume, :receipt_finalize] do
    @tag capture_log: true
    test "#{action} rolls back every persistent fact when #{phase} fails" do
      run_fault_case(unquote(action), unquote(phase))
    end
  end

  for phase <- [:notification_insert, :notification_wakeup] do
    @tag capture_log: true
    test "first publication rolls back when #{phase} fails" do
      run_fault_case(:publication, unquote(phase))
    end
  end

  for action <- [:publication, :removal] do
    test "#{action} commits the real sealed Release identity and replay adds no write" do
      prepare_release(unquote(action)) |> assert_release_success()
    end
  end

  @tag capture_log: true
  test "failure after one public selection rolls back a multi-Doc release" do
    f = prepare_release(:publication)

    node =
      Repo.get_by!(CMS.Model.DocsTreeNode,
        community_id: f.community.id,
        node_id: f.node_id,
        stage: :draft
      )

    second =
      create_node(f.community, f.actor, %{
        type: :page,
        title: "Second document",
        parent_node_id: node.parent_node_id
      })

    second_article = Repo.get!(CMS.Model.Article, second.article_id)
    second_work = Repo.get!(CMS.Model.ArticleWorkingCopy, second.working_copy_id)

    assert {:ok, saved} =
             CMS.Articles.Commands.SaveWorkingCopy.execute(
               second_article,
               f.community,
               second_work.id,
               %{
                 title: "Second document",
                 body_bag: mock_body_bag(mock_rich_text("Second body"))
               },
               second_work.revision,
               f.actor,
               Ecto.UUID.generate()
             )

    assert {:ok, queue} = Queue.read(f.community)

    assert {:ok, _} =
             Enqueue.execute(
               f.community,
               queue.queue_revision,
               [%{article_id: second_article.id, default_revision: saved.revision}],
               f.actor,
               Ecto.UUID.generate()
             )

    assert {:ok, queue} = Queue.read(f.community)
    before = persistent_facts()
    command_id = Ecto.UUID.generate()
    trigger = "fail_second_public_" <> String.replace(Ecto.UUID.generate(), "-", "")

    Repo.query!("""
    CREATE FUNCTION cms.#{trigger}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.article_id IN ('#{f.article.id}'::uuid, '#{second_article.id}'::uuid)
         AND EXISTS (SELECT 1 FROM cms.article_publics
           WHERE article_id IN ('#{f.article.id}'::uuid, '#{second_article.id}'::uuid)) THEN
        RAISE EXCEPTION 'second_public_selection';
      END IF;
      RETURN NEW;
    END $$
    """)

    ref = make_ref()
    handler_id = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])
    :ok = :telemetry.attach(handler_id, event, &__MODULE__.capture_second_public/4, {self(), ref})

    try do
      Repo.query!(
        "CREATE TRIGGER #{trigger} BEFORE INSERT ON cms.article_publics FOR EACH ROW EXECUTE FUNCTION cms.#{trigger}()"
      )

      assert {:error, _} =
               ReleaseQueue.execute(f.community, queue.queue_revision, f.actor, command_id)

      assert_receive {^ref, :second_public_selection}
      assert_unchanged(before)
      refute Repo.get_by(CommandReceipt, command_id: command_id)
    after
      :telemetry.detach(handler_id)
      Repo.query!("DROP TRIGGER IF EXISTS #{trigger} ON cms.article_publics")
      Repo.query!("DROP FUNCTION IF EXISTS cms.#{trigger}()")
    end
  end

  @doc false
  def capture_second_public(
        _event,
        _measurements,
        %{result: {:error, %Postgrex.Error{postgres: %{message: "second_public_selection"}}}},
        {owner, ref}
      ) do
    send(owner, {ref, :second_public_selection})
  end

  def capture_second_public(_event, _measurements, _metadata, _config), do: :ok

  test "an approved release reuses its pinned Snapshot on command replay" do
    f = prepare_release(:publication)

    assert {:ok, _} =
             CMS.DocTree.Commands.ConfigureQueue.execute(
               f.community,
               f.queue.approval_policy_revision,
               true,
               true,
               f.actor,
               Ecto.UUID.generate()
             )

    assert {:ok, queue} = Queue.read(f.community)

    assert {:ok, approved} =
             CMS.DocTree.Commands.ApproveQueue.execute(
               f.community,
               queue.queue_revision,
               f.actor,
               Ecto.UUID.generate()
             )

    pinned =
      Repo.get_by!(CMS.Model.DocsPublishApprovalArticle,
        approval_id: approved.approval_id,
        article_id: f.article.id
      )

    command_id = Ecto.UUID.generate()

    assert {:ok, result} =
             ReleaseQueue.execute(f.community, queue.queue_revision, f.actor, command_id)

    release = Repo.get!(DocsRelease, result.release_id)
    assert release.approval_id == approved.approval_id
    assert Repo.get!(CMS.Model.ArticlePublic, f.article.id).snapshot_id == pinned.snapshot_id

    assert Repo.get_by!(CMS.Model.DocsReleaseArticle,
             release_id: release.id,
             article_id: f.article.id
           ).snapshot_id ==
             pinned.snapshot_id

    committed = persistent_facts()

    assert {:ok, ^result} =
             ReleaseQueue.execute(f.community, queue.queue_revision, f.actor, command_id)

    assert_unchanged(committed)
  end

  @tag timeout: 60_000
  test "two administrators competing to release one queue produce one release" do
    Sandbox.unboxed_run(Repo, fn ->
      initial_jobs = Repo.all(from(row in Oban.Job, select: row.id))
      initial_events = Repo.all(from(row in Event, select: row.id))
      initial_receipts = Repo.all(from(row in CommandReceipt, select: row.id))
      f = prepare_release(:publication)

      try do
        {:ok, second_actor} = db_insert(:user)

        %CommunityAdmin{}
        |> CommunityAdmin.changeset(%{
          user_id: second_actor.id,
          community_id: f.community.id,
          permissions: %{"doc.queue.publish" => true}
        })
        |> Repo.insert!()

        tasks =
          Enum.map([f.actor, second_actor], fn actor ->
            Task.async(fn ->
              Sandbox.unboxed_run(Repo, fn ->
                receive do
                  :release ->
                    ReleaseQueue.execute(
                      f.community,
                      f.queue.queue_revision,
                      actor,
                      Ecto.UUID.generate()
                    )
                after
                  10_000 -> {:error, :test_timeout}
                end
              end)
            end)
          end)

        Enum.each(tasks, &send(&1.pid, :release))
        results = Enum.map(tasks, &Task.await(&1, 20_000))
        assert Enum.count(results, &match?({:ok, _}, &1)) == 1

        assert Enum.count(
                 results,
                 &match?({:error, {:queue_version_conflict, :queue_revision, _}}, &1)
               ) == 1

        {:ok, result} = Enum.find(results, &match?({:ok, _}, &1))

        assert Repo.aggregate(
                 from(release in DocsRelease, where: release.community_id == ^f.community.id),
                 :count
               ) == 1

        assert {:ok, queue} = Queue.read(f.community)
        assert queue.queue_revision == f.queue.queue_revision + 1
        public = Repo.get!(CMS.Model.ArticlePublic, f.article.id)

        member =
          Repo.get_by!(CMS.Model.DocsReleaseArticle,
            release_id: result.release_id,
            article_id: f.article.id
          )

        assert member.snapshot_id == public.snapshot_id

        assert Repo.exists?(
                 from(node in CMS.Model.DocsTreeNode,
                   where:
                     node.community_id == ^f.community.id and node.stage == :public and
                       node.doc_id == ^f.article.id
                 )
               )

        assert Repo.exists?(
                 from(event in Event,
                   where:
                     event.event == "article.published" and event.resource_id == ^f.article.id
                 )
               )
      after
        cleanup_committed(f, initial_jobs, initial_events, initial_receipts)
      end
    end)
  end

  @tag timeout: 60_000
  test "independent report transactions crossing the threshold create one hold" do
    Sandbox.unboxed_run(Repo, fn ->
      initial_jobs = Repo.all(from(row in Oban.Job, select: row.id))
      initial_events = Repo.all(from(row in Event, select: row.id))
      initial_receipts = Repo.all(from(row in CommandReceipt, select: row.id))
      f = prepare_release(:publication)

      try do
        assert {:ok, _} =
                 ReleaseQueue.execute(
                   f.community,
                   f.queue.queue_revision,
                   f.actor,
                   Ecto.UUID.generate()
                 )

        public = Repo.get!(CMS.Model.ArticlePublic, f.article.id)

        target = %{
          owner: :cms,
          target_type: :article,
          target_id: f.article.id,
          community_id: f.community.id,
          observed_version: CMS.Review.SnapshotVersion.from_id(public.snapshot_id)
        }

        threshold = CMS.Review.Config.report_threshold()
        assert threshold >= 2

        reporters =
          Enum.map(1..threshold, fn _ ->
            {:ok, reporter} = db_insert(:user)
            reporter
          end)

        {prior, competing} = Enum.split(reporters, threshold - 2)

        submit = fn reporter ->
          GroupherServer.AlertWall.Commands.SubmitReport.execute(
            target,
            :spam,
            "independent report",
            reporter,
            Ecto.UUID.generate()
          )
        end

        Enum.each(prior, fn reporter -> assert {:ok, _} = submit.(reporter) end)

        tasks =
          Enum.map(competing, fn reporter ->
            Task.async(fn ->
              Sandbox.unboxed_run(Repo, fn ->
                receive do
                  :submit -> submit.(reporter)
                after
                  10_000 -> {:error, :test_timeout}
                end
              end)
            end)
          end)

        Enum.each(tasks, &send(&1.pid, :submit))
        assert Enum.all?(Enum.map(tasks, &Task.await(&1, 20_000)), &match?({:ok, _}, &1))

        assert Repo.aggregate(
                 from(report in GroupherServer.AlertWall.Model.UserReport,
                   where:
                     report.target_id == ^f.article.id and
                       report.observed_version == ^target.observed_version
                 ),
                 :count
               ) == threshold

        assert Repo.aggregate(
                 from(block in CMS.Model.ArticleReviewBlock,
                   where:
                     block.article_id == ^f.article.id and block.type == :report_threshold_hold and
                       is_nil(block.resolved_at)
                 ),
                 :count
               ) == 1
      after
        cleanup_committed(f, initial_jobs, initial_events, initial_receipts)
      end
    end)
  end

  @tag timeout: 60_000
  test "independent publishers competing for an Article public head commit once" do
    Sandbox.unboxed_run(Repo, fn ->
      initial_jobs = Repo.all(from(row in Oban.Job, select: row.id))
      initial_events = Repo.all(from(row in Event, select: row.id))
      initial_receipts = Repo.all(from(row in CommandReceipt, select: row.id))
      {community, article, _attrs, actor} = mock_article(:post)
      f = %{community: community, article: article}

      try do
        {:ok, other} = db_insert(:user)

        other_author = Repo.insert!(%CMS.Model.Author{user_id: other.id})

        Repo.insert!(
          CMS.Model.ArticleCoAuthor.changeset(%CMS.Model.ArticleCoAuthor{}, %{
            article_id: article.id,
            author_id: other_author.id,
            joined_at: DateTime.utc_now(:second),
            permissions: %{"article.read_draft" => true, "article.publish" => true}
          })
        )

        work =
          Repo.get_by!(CMS.Model.ArticleWorkingCopy, article_id: article.id, scope_type: :default)

        public = Repo.get!(CMS.Model.ArticlePublic, article.id)

        assert {:ok, saved} =
                 CMS.Articles.save_working_copy(
                   article,
                   community,
                   work.id,
                   %{
                     title: "Competing publication",
                     body_bag: mock_body_bag(mock_rich_text("new public body"))
                   },
                   work.revision,
                   actor,
                   Ecto.UUID.generate()
                 )

        source = %{working_copy_id: work.id, revision: saved.revision}

        tasks =
          Enum.map([actor, other], fn publisher ->
            Task.async(fn ->
              Sandbox.unboxed_run(Repo, fn ->
                receive do
                  :publish ->
                    CMS.Articles.publish_article(
                      article,
                      community,
                      source,
                      public.snapshot_id,
                      publisher,
                      Ecto.UUID.generate()
                    )
                after
                  10_000 -> {:error, :test_timeout}
                end
              end)
            end)
          end)

        Enum.each(tasks, &send(&1.pid, :publish))
        results = Enum.map(tasks, &Task.await(&1, 20_000))
        assert Enum.count(results, &match?({:ok, _}, &1)) == 1
        assert Enum.count(results, &match?({:error, :public_conflict}, &1)) == 1
        {:ok, result} = Enum.find(results, &match?({:ok, _}, &1))
        assert Repo.get!(CMS.Model.ArticlePublic, article.id).snapshot_id == result.snapshot.id

        assert Repo.get!(CMS.Model.ArticlePublicBody, article.id).snapshot_id ==
                 result.snapshot.id

        refute result.snapshot.id == public.snapshot_id
      after
        cleanup_committed(f, initial_jobs, initial_events, initial_receipts)
      end
    end)
  end

  defp run_fault_case(action, phase) when phase in [:wakeup, :notification_wakeup] do
    # Oban's failed SQL insert disconnects a Sandbox-owned connection. Use committed
    # fixtures here so that losing the Sandbox transaction cannot erase the baseline.
    Ecto.Adapters.SQL.Sandbox.unboxed_run(Repo, fn ->
      initial_jobs = Repo.all(from(row in Oban.Job, select: row.id))
      initial_events = Repo.all(from(row in Event, select: row.id))
      initial_receipts = Repo.all(from(row in CommandReceipt, select: row.id))
      f = prepare_release(action)

      try do
        check_fault(f, phase)
      after
        cleanup_committed(f, initial_jobs, initial_events, initial_receipts)
      end
    end)
  end

  defp run_fault_case(action, phase), do: check_fault(prepare_release(action), phase)

  defp check_fault(fixture, phase) do
    command_id = Ecto.UUID.generate()
    before = persistent_facts()
    proof = inject_failure(fixture, phase, command_id)
    assert_phase(proof, fixture, phase)
    assert_unchanged(before)
    refute Repo.get_by(CommandReceipt, command_id: command_id)
  end

  defp cleanup_committed(f, initial_jobs, initial_events, initial_receipts) do
    assert {:ok, _} =
             CMS.Communities.Lifecycle.request_destroy(f.community.id,
               recover_until: DateTime.add(DateTime.utc_now(:second), -1, :second),
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Communities.Lifecycle.schedule_destroy(f.community.id,
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Communities.Lifecycle.destroy(f.community.id,
               operation_ref: Ecto.UUID.generate()
             )

    new_jobs = Repo.all(from(row in Oban.Job, select: row.id)) -- initial_jobs
    new_events = Repo.all(from(row in Event, select: row.id)) -- initial_events
    new_receipts = Repo.all(from(row in CommandReceipt, select: row.id)) -- initial_receipts
    Repo.delete_all(from(row in Oban.Job, where: row.id in ^new_jobs))
    Repo.delete_all(from(row in CMS.Outbox.Retry, where: row.event_id in ^new_events))
    Repo.delete_all(from(row in Event, where: row.id in ^new_events))
    Repo.delete_all(from(row in CommandReceipt, where: row.id in ^new_receipts))

    if f.article.thread == :doc do
      refute Repo.get(CMS.Model.Article, f.article.id)
    end

    refute Repo.exists?(from(row in DocsRelease, where: row.community_id == ^f.community.id))
    # The domain retains the destroyed Community/blocker facts and actors; a Post
    # also survives Community destruction under its independent Article lifecycle.
    # Only this test's wakeups, intent rows and Receipt fixtures are removed.
  end

  defp assert_release_success(f) do
    command_id = Ecto.UUID.generate()

    assert {:ok, result} =
             ReleaseQueue.execute(f.community, f.queue.queue_revision, f.actor, command_id)

    receipt = Repo.get_by!(CommandReceipt, command_id: command_id)
    assert {:ok, operation_ref} = Ecto.UUID.cast(receipt.operation_ref)
    refute operation_ref == command_id
    release = Repo.get!(DocsRelease, result.release_id)
    assert is_integer(release.id)
    assert release.sealed
    assert release.community_id == f.community.id

    member =
      Repo.get_by!(CMS.Model.DocsReleaseArticle,
        release_id: release.id,
        article_id: f.article.id
      )

    assert member.action == if(f.action == :publication, do: :publish, else: :delete)
    assert {:ok, queue} = Queue.read(f.community)
    assert queue.public_release_id == release.id
    assert queue.queue_revision == f.queue.queue_revision + 1

    refute Repo.exists?(from(row in CMS.Model.DocsQueueArticle, where: row.queue_id == ^queue.id))

    refute Repo.exists?(from(row in DocsQueueTreeChange, where: row.queue_id == ^queue.id))

    events = Repo.all(from(row in Event, where: row.operation_ref == ^operation_ref))
    event = Enum.find(events, &(&1.event == f.effect))
    assert event
    assert event.resource_id == f.article.id
    assert event.data["release_id"] == release.id
    assert event.data["community_id"] == f.community.id

    assert event.data["inner_id"] ==
             Repo.get_by!(CMS.Model.ArticleBinding,
               community_id: f.community.id,
               article_id: f.article.id
             ).inner_id

    if f.action == :publication do
      public = Repo.get!(CMS.Model.ArticlePublic, f.article.id)
      assert member.snapshot_id == public.snapshot_id
      assert event.data["snapshot_id"] == public.snapshot_id
      assert Enum.any?(events, &(&1.event == "article.first_published_notification"))

      assert Repo.exists?(
               from(log in Activity.Model.DocLog,
                 where:
                   log.article_id == ^f.article.id and log.operation_ref == ^operation_ref and
                     log.action == :published
               )
             )
    else
      assert member.snapshot_id == nil
      refute Repo.get(CMS.Model.ArticlePublic, f.article.id)

      refute Repo.exists?(
               from(node in CMS.Model.DocsTreeNode,
                 where:
                   node.community_id == ^f.community.id and node.stage == :public and
                     node.doc_id == ^f.article.id
               )
             )

      refute Enum.any?(events, &(&1.event == "article.first_published_notification"))
    end

    for intent <- events do
      assert Repo.aggregate(
               from(job in Oban.Job, where: job.args["event_id"] == ^intent.id),
               :count
             ) == 1
    end

    committed = persistent_facts()

    assert {:ok, ^result} =
             ReleaseQueue.execute(f.community, f.queue.queue_revision, f.actor, command_id)

    assert_unchanged(committed)

    assert {:ok, repeated} =
             Repo.transact_result(fn ->
               binding =
                 Repo.get_by!(CMS.Model.ArticleBinding,
                   article_id: f.article.id,
                   community_id: f.community.id
                 )

               if f.action == :publication do
                 snapshot = Repo.get!(CMS.Model.ArticleSnapshot, member.snapshot_id)

                 CMS.Articles.Effects.release_published(
                   binding,
                   f.community,
                   snapshot,
                   release,
                   operation_ref
                 )
               else
                 CMS.Articles.Effects.release_removed(
                   binding,
                   f.community,
                   release,
                   operation_ref
                 )
               end
             end)

    assert repeated.id == event.id
    assert_unchanged(committed)
  end

  defp prepare_release(:publication) do
    {:ok, actor} =
      db_insert(:user, %{
        login: "release-" <> Base.url_encode64(:crypto.strong_rand_bytes(9), padding: false)
      })

    {:ok, community} = mock_community(actor)
    lord = Repo.get_by!(CommunityAdmin, user_id: actor.id, community_id: community.id)
    Repo.update!(Ecto.Changeset.change(lord, is_lord: true))
    tab = create_node(community, actor, %{type: :tab, title: "Docs"})

    group =
      create_node(community, actor, %{type: :group, title: "Guide", parent_node_id: tab.node_id})

    page =
      create_node(community, actor, %{
        type: :page,
        title: "Atomic publication",
        parent_node_id: group.node_id
      })

    article = Repo.get!(CMS.Model.Article, page.article_id)
    work = Repo.get!(CMS.Model.ArticleWorkingCopy, page.working_copy_id)

    assert {:ok, saved} =
             CMS.Articles.Commands.SaveWorkingCopy.execute(
               article,
               community,
               work.id,
               %{
                 title: "Atomic publication",
                 body_bag: mock_body_bag(mock_rich_text("Release body"))
               },
               work.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, queue} = Queue.read(community)

    assert {:ok, _} =
             Enqueue.execute(
               community,
               queue.queue_revision,
               [%{article_id: article.id, default_revision: saved.revision}],
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, queue} = Queue.read(community)

    %{
      action: :publication,
      effect: "article.published",
      community: community,
      actor: actor,
      article: article,
      queue: queue,
      node_id: page.node_id
    }
  end

  defp prepare_release(:removal) do
    f = prepare_release(:publication)

    assert {:ok, _} =
             ReleaseQueue.execute(
               f.community,
               f.queue.queue_revision,
               f.actor,
               Ecto.UUID.generate()
             )

    assert {:ok, queue} = Queue.read(f.community)

    assert {:ok, _} =
             DeleteWorkspaceNode.execute(
               f.community,
               queue.tree_lock_version,
               queue.queue_revision,
               f.node_id,
               nil,
               f.actor,
               Ecto.UUID.generate()
             )

    assert {:ok, queue} = Queue.read(f.community)
    %{f | action: :removal, effect: "article.visibility_changed", queue: queue}
  end

  defp create_node(community, actor, attrs) do
    assert {:ok, queue} = Queue.read(community)

    assert {:ok, result} =
             CreateWorkspaceNode.execute(
               community,
               queue.tree_lock_version,
               attrs,
               actor,
               Ecto.UUID.generate()
             )

    result
  end

  defp persistent_facts do
    Map.new(@rollback_schemas, fn schema -> {schema, Repo.all(schema) |> Enum.sort()} end)
  end

  defp assert_unchanged(before) do
    for {schema, rows} <- before do
      assert Repo.all(schema) |> Enum.sort() == rows,
             "persistent facts changed: #{inspect(schema)}"
    end
  end

  defp inject_failure(f, phase, command_id) do
    {table, operation, condition, release_id} = fault_target(f, phase, command_id)
    name = "identity_release_" <> String.replace(Ecto.UUID.generate(), "-", "")

    observe = """
    SELECT jsonb_build_object(
      'operation_ref', receipt.operation_ref,
      'release_id', #{release_id},
      'sealed', (SELECT sealed FROM cms.doc_publish_releases WHERE id = #{release_id}),
      'public_snapshot', (SELECT snapshot_id FROM cms.article_publics WHERE article_id = '#{f.article.id}'::uuid),
      'members', (SELECT count(*) FROM cms.doc_publish_release_articles WHERE release_id = #{release_id}),
      'effects', (SELECT COALESCE(jsonb_agg(event ORDER BY event), '[]'::jsonb)
        FROM cms.outbox_events WHERE operation_ref = receipt.operation_ref AND event LIKE 'article.%'),
      'wakeups', (SELECT count(*) FROM public.oban_jobs job JOIN cms.outbox_events event
        ON job.args->>'event_id' = event.id::text
        WHERE event.operation_ref = receipt.operation_ref AND event.event LIKE 'article.%'),
      'queue_revision', queue.queue_revision,
      'queue_members', (SELECT count(*) FROM cms.docs_queue_articles WHERE queue_id = queue.id),
      'queue_changes', (SELECT count(*) FROM cms.docs_queue_tree_changes WHERE queue_id = queue.id)
    ) INTO proof
    FROM cms.command_receipts receipt CROSS JOIN cms.docs_publish_queues queue
    WHERE receipt.command_id = '#{command_id}'::uuid AND queue.id = '#{f.queue.id}'::uuid;
    """

    Repo.query!("""
    CREATE FUNCTION cms.#{name}() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE proof jsonb;
    BEGIN
      IF #{condition} THEN
        #{observe}
        RAISE EXCEPTION 'identity_release_fault:%', proof;
      END IF;
      RETURN #{if operation == "DELETE", do: "OLD", else: "NEW"};
    END $$
    """)

    ref = make_ref()
    handler_id = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])
    :ok = :telemetry.attach(handler_id, event, &__MODULE__.capture_fault/4, {self(), ref})

    try do
      Repo.query!(
        "CREATE TRIGGER #{name} BEFORE #{operation} ON #{table} FOR EACH ROW EXECUTE FUNCTION cms.#{name}()"
      )

      # Call the actual receipt entry without an extra rollback wrapper: its own
      # transaction must undo the fault, rather than a test-owned outer rollback.
      assert {:error, _reason} =
               ReleaseQueue.execute(f.community, f.queue.queue_revision, f.actor, command_id)

      assert_receive {^ref, proof}
      Jason.decode!(proof)
    after
      :telemetry.detach(handler_id)
      Repo.query!("DROP TRIGGER IF EXISTS #{name} ON #{table}")
      Repo.query!("DROP FUNCTION IF EXISTS cms.#{name}()")
    end
  end

  @doc false
  def capture_fault(
        _event,
        _measurements,
        %{
          result:
            {:error, %Postgrex.Error{postgres: %{message: "identity_release_fault:" <> proof}}}
        },
        {owner, ref}
      ) do
    send(owner, {ref, proof})
  end

  def capture_fault(_event, _measurements, _metadata, _config), do: :ok

  defp fault_target(f, :release_seal, _command_id) do
    {"cms.doc_publish_releases", "UPDATE",
     "NEW.community_id = #{f.community.id} AND NEW.sealed AND NOT OLD.sealed", "NEW.id"}
  end

  defp fault_target(f, phase, _command_id) when phase in [:effect_insert, :notification_insert] do
    effect =
      if phase == :effect_insert, do: f.effect, else: "article.first_published_notification"

    {"cms.outbox_events", "INSERT",
     "NEW.resource_id = '#{f.article.id}' AND NEW.event = '#{effect}'", "queue.public_release_id"}
  end

  defp fault_target(f, phase, _command_id) when phase in [:wakeup, :notification_wakeup] do
    effect = if phase == :wakeup, do: f.effect, else: "article.first_published_notification"

    {"public.oban_jobs", "INSERT",
     "EXISTS (SELECT 1 FROM cms.outbox_events WHERE id::text = NEW.args->>'event_id' AND resource_id = '#{f.article.id}' AND event = '#{effect}')",
     "queue.public_release_id"}
  end

  defp fault_target(f, :queue_consume, _command_id) do
    {"cms.docs_queue_tree_changes", "DELETE", "OLD.queue_id = '#{f.queue.id}'::uuid",
     "queue.public_release_id"}
  end

  defp fault_target(_f, :receipt_finalize, command_id) do
    {"cms.command_receipts", "UPDATE",
     "NEW.command_id = '#{command_id}'::uuid AND NEW.confirmation IS NOT NULL",
     "queue.public_release_id"}
  end

  defp assert_phase(proof, f, phase) do
    assert {:ok, _} = Ecto.UUID.cast(proof["operation_ref"])
    assert is_integer(proof["release_id"])
    assert proof["members"] == 1

    if f.action == :publication do
      assert(proof["public_snapshot"])
    else
      assert(proof["public_snapshot"] == nil)
    end

    assert proof["sealed"] == (phase != :release_seal)

    expected =
      case phase do
        :release_seal ->
          []

        :effect_insert ->
          []

        :wakeup ->
          [f.effect]

        :notification_insert ->
          [f.effect]

        _ when f.action == :publication ->
          ["article.first_published_notification", f.effect] |> Enum.sort()

        _ ->
          [f.effect]
      end

    assert proof["effects"] == expected

    wakeups =
      if phase in [:wakeup, :notification_wakeup],
        do: length(expected) - 1,
        else: length(expected)

    assert proof["wakeups"] == wakeups

    assert proof["queue_revision"] ==
             f.queue.queue_revision + if(phase == :receipt_finalize, do: 1, else: 0)

    if phase == :receipt_finalize do
      assert proof["queue_members"] == 0
      assert proof["queue_changes"] == 0
    else
      assert proof["queue_changes"] > 0
    end
  end

  test "SaveQueue returns after commit and replays a stale revision without another save" do
    f = prepare_release(:publication)
    q = queue_copy(f)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "Queued presentation"}

    args = [
      f.community,
      f.queue.queue_revision,
      f.article.id,
      q.revision,
      attrs,
      f.actor,
      command_id
    ]

    assert {:ok, result} = apply(CMS.DocTree.Commands.SaveQueue, :execute, args)
    assert Repo.get!(CMS.Model.ArticleWorkingCopy, q.id).title == "Queued presentation"
    assert Repo.get_by!(CommandReceipt, command_id: command_id).confirmation
    before = persistent_facts()
    assert {:ok, ^result} = apply(CMS.DocTree.Commands.SaveQueue, :execute, args)
    assert_unchanged(before)
  end

  test "MergeQueue returns after commit and replays its original Confirmation" do
    f = prepare_release(:publication)
    q = queue_copy(f)
    d = default_copy(f)
    assert {:ok, saved} = save_title(f, d, "New default title")
    assert {:ok, queue} = Queue.read(f.community)
    command_id = Ecto.UUID.generate()

    args = [
      f.community,
      queue.queue_revision,
      f.article.id,
      saved.revision,
      q.revision,
      %{},
      f.actor,
      command_id
    ]

    assert {:ok, result} = apply(CMS.DocTree.Commands.MergeQueue, :execute, args)
    assert Repo.get!(CMS.Model.ArticleWorkingCopy, q.id).title == "New default title"
    assert Repo.get_by!(CommandReceipt, command_id: command_id).confirmation
    before = persistent_facts()
    assert {:ok, ^result} = apply(CMS.DocTree.Commands.MergeQueue, :execute, args)
    assert_unchanged(before)
  end

  test "RestoreSnapshot presents a historical copy after commit and replay preserves later edits" do
    f = prepare_release(:publication)
    a = publish_pending(f)
    publish_title(f, "A newer public title")
    assert default_copy(f) == nil
    command_id = Ecto.UUID.generate()
    args = [f.community, f.article.id, a.snapshot_id, nil, nil, f.actor, command_id]
    assert {:ok, result} = apply(CMS.DocTree.Commands.RestoreSnapshot, :execute, args)
    work = Repo.get!(CMS.Model.ArticleWorkingCopy, result.working_copy_id)
    assert work.title == "Atomic publication"
    assert work.revision == result.revision
    assert Repo.get_by!(CommandReceipt, command_id: command_id).confirmation
    assert {:ok, _} = save_title(f, work, "Later unpublished edit")
    before = persistent_facts()
    assert {:ok, ^result} = apply(CMS.DocTree.Commands.RestoreSnapshot, :execute, args)
    assert_unchanged(before)
    assert default_copy(f).title == "Later unpublished edit"
    assert Repo.get!(CMS.Model.ArticleSnapshot, a.snapshot_id).title == "Atomic publication"
  end

  test "RestoreSnapshot preserves an existing default before restoring and presents a replay" do
    f = prepare_release(:publication)
    a = publish_pending(f)

    assert {:ok, opened} =
             CMS.DocTree.Commands.BeginEdit.execute(
               f.community,
               f.article.id,
               a.snapshot_id,
               f.actor,
               Ecto.UUID.generate()
             )

    work = Repo.get!(CMS.Model.ArticleWorkingCopy, opened.working_copy_id)
    assert {:ok, edited} = save_title(f, work, "Preserved unpublished content")
    command_id = Ecto.UUID.generate()

    args = [
      f.community,
      f.article.id,
      a.snapshot_id,
      edited.id,
      edited.revision,
      f.actor,
      command_id
    ]

    assert {:ok, result} = apply(CMS.DocTree.Commands.RestoreSnapshot, :execute, args)
    assert result.working_copy_id == edited.id
    assert result.revision == edited.revision + 1
    assert default_copy(f).title == "Atomic publication"

    preserved =
      Repo.one!(
        from(row in CMS.Model.ArticleSnapshot,
          where:
            row.source_working_copy_id == ^edited.id and row.source_revision == ^edited.revision
        )
      )

    assert preserved.title == "Preserved unpublished content"
    before = persistent_facts()
    assert {:ok, ^result} = apply(CMS.DocTree.Commands.RestoreSnapshot, :execute, args)
    assert_unchanged(before)
  end

  for choice <- [:source, :target] do
    @choice choice
    test "ResolvePostPublish #{@choice} presents and replays after the real conflict is removed" do
      f = prepare_release(:publication)
      q = queue_copy(f)
      d = default_copy(f)

      assert {:ok, _} =
               CMS.DocTree.Commands.SaveQueue.execute(
                 f.community,
                 f.queue.queue_revision,
                 f.article.id,
                 q.revision,
                 %{title: "Published Queue title"},
                 f.actor,
                 Ecto.UUID.generate()
               )

      assert {:ok, edited} = save_title(f, d, "Unpublished default title")
      publication = publish_pending(f)
      assert Repo.get_by!(CMS.Model.DocsPostPublishConflict, article_id: f.article.id)
      command_id = Ecto.UUID.generate()

      args = [
        f.community,
        f.article.id,
        edited.id,
        edited.revision,
        publication.snapshot_id,
        %{title: @choice},
        f.actor,
        command_id
      ]

      assert {:ok, result} = apply(CMS.DocTree.Commands.ResolvePostPublish, :execute, args)
      refute Repo.get_by(CMS.Model.DocsPostPublishConflict, article_id: f.article.id)

      case @choice do
        :source ->
          assert result.working_copy_revision == nil
          assert default_copy(f) == nil

        :target ->
          assert result.working_copy_revision == edited.revision
          assert default_copy(f).title == "Unpublished default title"
      end

      assert Repo.get!(CMS.Model.ArticlePublic, f.article.id).snapshot_id ==
               publication.snapshot_id

      assert Repo.get_by!(CommandReceipt, command_id: command_id).confirmation
      before = persistent_facts()
      assert {:ok, ^result} = apply(CMS.DocTree.Commands.ResolvePostPublish, :execute, args)
      assert_unchanged(before)
    end
  end

  test "Docs B to C to B content creates a new Q Snapshot and Release with independent effects" do
    f = prepare_release(:publication)
    a = publish_pending(f)
    a_receipt = Repo.get_by!(CommandReceipt, command_id: a.command_id)

    first_notice =
      Repo.get_by!(Event,
        operation_ref: a_receipt.operation_ref,
        event: "article.first_published_notification"
      )

    b = publish_title(f, "Version B", %{body_bag: mock_body_bag(mock_rich_text("Body B"))})
    b_event = consume_publication_fanout(f, b)
    c = publish_title(f, "Version C", %{body_bag: mock_body_bag(mock_rich_text("Body C"))})
    c_event = consume_publication_fanout(f, c)
    b_snapshot = Repo.get!(CMS.Model.ArticleSnapshot, b.snapshot_id)
    c_snapshot = Repo.get!(CMS.Model.ArticleSnapshot, c.snapshot_id)
    b_body = Repo.get!(CMS.Model.ArticleBody, b_snapshot.body_id)
    c_body = Repo.get!(CMS.Model.ArticleBody, c_snapshot.body_id)

    refute CMS.Model.ArticleBodyDocument.document(b_body) ==
             CMS.Model.ArticleBodyDocument.document(c_body)

    b_release = Repo.get!(DocsRelease, b.release_id)
    c_release = Repo.get!(DocsRelease, c.release_id)
    b_member = release_member(f, b.release_id)
    c_member = release_member(f, c.release_id)

    old_events =
      Repo.all(
        from(row in Event,
          where: row.operation_ref in ^[b_event.operation_ref, c_event.operation_ref]
        )
      )

    restore_command_id = Ecto.UUID.generate()

    assert {:ok, restored} =
             CMS.DocTree.Commands.RestoreSnapshot.execute(
               f.community,
               f.article.id,
               b.snapshot_id,
               nil,
               nil,
               f.actor,
               restore_command_id
             )

    assert default_copy(f).title == "Version B"
    assert {:ok, before_enqueue} = Queue.read(f.community)

    assert {:ok, _} =
             Enqueue.execute(
               f.community,
               before_enqueue.queue_revision,
               [%{article_id: f.article.id, default_revision: restored.revision}],
               f.actor,
               Ecto.UUID.generate()
             )

    q = queue_copy(f)
    assert {:ok, before_release} = Queue.read(f.community)
    command_id = Ecto.UUID.generate()

    assert {:ok, result} =
             ReleaseQueue.execute(f.community, before_release.queue_revision, f.actor, command_id)

    public = Repo.get!(CMS.Model.ArticlePublic, f.article.id)
    selected = Repo.get!(CMS.Model.ArticleSnapshot, public.snapshot_id)
    release = Repo.get!(DocsRelease, result.release_id)
    receipt = Repo.get_by!(CommandReceipt, command_id: command_id)
    restore_receipt = Repo.get_by!(CommandReceipt, command_id: restore_command_id)
    member = release_member(f, release.id)
    event = publication_event(f, command_id)

    assert selected.id not in [b_snapshot.id, c_snapshot.id]
    assert selected.source_working_copy_id == q.id
    assert selected.source_revision == q.revision
    assert selected.source_working_copy_id != b_snapshot.source_working_copy_id

    assert Map.take(selected, [:title, :digest, :slug, :cover_edit_snapshot_id]) ==
             Map.take(b_snapshot, [:title, :digest, :slug, :cover_edit_snapshot_id])

    body = Repo.get!(CMS.Model.ArticleBody, selected.body_id)

    assert CMS.Model.ArticleBodyDocument.document(body) ==
             CMS.Model.ArticleBodyDocument.document(b_body)

    public_body = Repo.get!(CMS.Model.ArticlePublicBody, f.article.id)
    assert public_body.snapshot_id == selected.id

    assert CMS.Model.ArticleBodyDocument.document(public_body) ==
             CMS.Model.ArticleBodyDocument.document(b_body)

    assert release.sealed
    assert release.id not in [b_release.id, c_release.id]
    assert release.base_release_id == c_release.id
    assert member.action == :publish
    assert member.snapshot_id == selected.id
    assert {:ok, released_queue} = Queue.read(f.community)
    assert released_queue.public_release_id == release.id

    assert receipt.operation_ref not in [
             b_event.operation_ref,
             c_event.operation_ref,
             restore_receipt.operation_ref
           ]

    assert {:ok, _} = Ecto.UUID.cast(receipt.operation_ref)
    assert event.operation_ref == receipt.operation_ref
    assert event.data["snapshot_id"] == selected.id
    assert event.data["release_id"] == release.id
    assert event.dedupe_key not in [b_event.dedupe_key, c_event.dedupe_key]
    assert event.id not in [b_event.id, c_event.id]

    binding =
      Repo.get_by!(CMS.Model.ArticleBinding,
        article_id: f.article.id,
        community_id: f.community.id
      )

    assert {:ok, current} =
             CMS.FrontDesk.article(%{
               community: f.community.slug,
               thread: :doc,
               inner_id: binding.inner_id
             })

    assert current.title == "Version B"
    assert current.snapshot_id == selected.id

    assert consume_publication_fanout(f, %{command_id: command_id}).id == event.id
    assert Repo.get!(Event, b_event.id).status == :done
    assert Repo.get!(Event, c_event.id).status == :done
    assert Repo.get!(CMS.Model.ArticleSnapshot, b_snapshot.id) == b_snapshot
    assert Repo.get!(CMS.Model.ArticleSnapshot, c_snapshot.id) == c_snapshot
    assert Repo.get!(CMS.Model.ArticleBody, b_body.id) == b_body
    assert Repo.get!(CMS.Model.ArticleBody, c_body.id) == c_body
    assert Repo.get!(DocsRelease, b_release.id) == b_release
    assert Repo.get!(DocsRelease, c_release.id) == c_release
    assert release_member(f, b_release.id) == b_member
    assert release_member(f, c_release.id) == c_member
    for old <- old_events, do: assert(Repo.get!(Event, old.id) == old)

    assert Repo.get!(Event, first_notice.id) == first_notice

    assert Repo.aggregate(
             from(row in Event,
               where:
                 row.resource_id == ^f.article.id and
                   row.event == "article.first_published_notification"
             ),
             :count
           ) == 1

    before = persistent_facts()

    assert {:ok, ^result} =
             ReleaseQueue.execute(f.community, before_release.queue_revision, f.actor, command_id)

    assert_unchanged(before)

    assert {:ok, repeated} =
             Repo.transact_result(fn ->
               CMS.Articles.Effects.release_updated(
                 binding,
                 f.community,
                 selected,
                 release,
                 receipt.operation_ref
               )
             end)

    assert repeated.id == event.id
    assert_unchanged(before)
  end

  test "a restored draft with prior publication history can publish a new public head" do
    Sandbox.unboxed_run(Repo, fn ->
      f = prepare_release(:publication)
      publish_pending(f)

      original_lifecycle = Repo.get_by!(CMS.Model.ArticleLifecycle, article_id: f.article.id)
      assert original_lifecycle.state == :published
      assert %DateTime{} = original_lifecycle.first_published_at

      {:ok, queue} = Queue.read(f.community)

      assert {:ok, deleted} =
               DeleteWorkspaceNode.execute(
                 f.community,
                 queue.tree_lock_version,
                 queue.queue_revision,
                 f.node_id,
                 nil,
                 f.actor,
                 Ecto.UUID.generate()
               )

      {:ok, queue} = Queue.read(f.community)

      assert {:ok, _} =
               ReleaseQueue.execute(
                 f.community,
                 queue.queue_revision,
                 f.actor,
                 Ecto.UUID.generate()
               )

      refute Repo.get(CMS.Model.ArticlePublic, f.article.id)
      deleted_lifecycle = Repo.get_by!(CMS.Model.ArticleLifecycle, article_id: f.article.id)
      assert deleted_lifecycle.state == :deleted
      assert deleted_lifecycle.first_published_at == original_lifecycle.first_published_at

      {:ok, trash_item} =
        CMS.Articles.CommunityTrashQuery.get(f.community, f.actor, :doc, deleted.trash_action_id)

      {:ok, queue} = Queue.read(f.community)

      assert {:ok, _restored} =
               RestoreWorkspaceNode.execute(
                 f.community,
                 queue.tree_lock_version,
                 queue.queue_revision,
                 deleted.trash_action_id,
                 trash_item.record_revision,
                 :restore_original,
                 nil,
                 f.actor,
                 Ecto.UUID.generate()
               )

      restored_lifecycle = Repo.get_by!(CMS.Model.ArticleLifecycle, article_id: f.article.id)
      assert restored_lifecycle.state == :draft
      assert restored_lifecycle.first_published_at == original_lifecycle.first_published_at

      recovery =
        Repo.get_by!(CMS.Model.ArticleWorkingCopy,
          article_id: f.article.id,
          scope_type: :default,
          scope_id: f.article.id
        )

      {:ok, queue} = Queue.read(f.community)

      assert {:ok, _} =
               Enqueue.execute(
                 f.community,
                 queue.queue_revision,
                 [%{article_id: f.article.id, default_revision: recovery.revision}],
                 f.actor,
                 Ecto.UUID.generate()
               )

      {:ok, queue} = Queue.read(f.community)

      assert {:ok, _} =
               ReleaseQueue.execute(
                 f.community,
                 queue.queue_revision,
                 f.actor,
                 Ecto.UUID.generate()
               )

      published_lifecycle = Repo.get_by!(CMS.Model.ArticleLifecycle, article_id: f.article.id)
      assert published_lifecycle.state == :published
      assert published_lifecycle.first_published_at == original_lifecycle.first_published_at
      assert Repo.get(CMS.Model.ArticlePublic, f.article.id)
    end)
  end

  defp publication_event(f, command_id) do
    receipt = Repo.get_by!(CommandReceipt, command_id: command_id)

    Repo.get_by!(Event,
      operation_ref: receipt.operation_ref,
      resource_id: f.article.id,
      event: "article.updated"
    )
  end

  defp consume_publication_fanout(f, %{command_id: command_id}) do
    event = publication_event(f, command_id)
    job = %Oban.Job{args: %{"event_id" => event.id}, attempt: 1, max_attempts: 8}
    assert {:ok, :pass} = GroupherServer.Jobs.CMSOutboxArticle.perform(job)
    done = Repo.get!(Event, event.id)
    assert done.status == :done

    children =
      Repo.all(
        from(row in Event, where: row.dedupe_key == ^CMS.Outbox.DedupeKey.encode([event.id]))
      )

    assert Enum.sort(Enum.map(children, & &1.event)) == [
             "article.cdn_purge",
             "article.search_sync",
             "press.cache_invalidation"
           ]

    done
  end

  defp release_member(f, release_id) do
    Repo.get_by!(CMS.Model.DocsReleaseArticle, release_id: release_id, article_id: f.article.id)
  end

  defp default_copy(f) do
    Repo.get_by(CMS.Model.ArticleWorkingCopy, article_id: f.article.id, scope_type: :default)
  end

  defp queue_copy(f) do
    member =
      Repo.get_by!(CMS.Model.DocsQueueArticle, queue_id: f.queue.id, article_id: f.article.id)

    Repo.get!(CMS.Model.ArticleWorkingCopy, member.working_copy_id)
  end

  defp save_title(f, work, title, attrs \\ %{}) do
    CMS.Articles.Commands.SaveWorkingCopy.execute(
      f.article,
      f.community,
      work.id,
      Map.put(attrs, :title, title),
      work.revision,
      f.actor,
      Ecto.UUID.generate()
    )
  end

  defp publish_pending(f) do
    assert {:ok, queue} = Queue.read(f.community)
    command_id = Ecto.UUID.generate()

    assert {:ok, released} =
             ReleaseQueue.execute(f.community, queue.queue_revision, f.actor, command_id)

    public = Repo.get!(CMS.Model.ArticlePublic, f.article.id)
    %{snapshot_id: public.snapshot_id, release_id: released.release_id, command_id: command_id}
  end

  defp publish_title(f, title, attrs \\ %{}) do
    public = Repo.get!(CMS.Model.ArticlePublic, f.article.id)

    assert {:ok, opened} =
             CMS.DocTree.Commands.BeginEdit.execute(
               f.community,
               f.article.id,
               public.snapshot_id,
               f.actor,
               Ecto.UUID.generate()
             )

    assert {:ok, edited} =
             save_title(
               f,
               Repo.get!(CMS.Model.ArticleWorkingCopy, opened.working_copy_id),
               title,
               attrs
             )

    assert {:ok, queue} = Queue.read(f.community)

    assert {:ok, _} =
             Enqueue.execute(
               f.community,
               queue.queue_revision,
               [%{article_id: f.article.id, default_revision: edited.revision}],
               f.actor,
               Ecto.UUID.generate()
             )

    publish_pending(f)
  end
end
