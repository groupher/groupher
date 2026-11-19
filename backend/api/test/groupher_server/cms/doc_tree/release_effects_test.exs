defmodule GroupherServer.Test.CMS.DocTree.ReleaseEffectsTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{Accounts, Activity, CMS, Repo}
  alias CMS.DocTree.Commands.{CreateWorkspaceNode, DeleteWorkspaceNode, Enqueue, ReleaseQueue}
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
    refute Repo.get(CMS.Model.Article, f.article.id)
    refute Repo.exists?(from(row in DocsRelease, where: row.community_id == ^f.community.id))
    # The domain retains the destroyed Community/blocker facts and the actor.
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
               CMS.Articles.Effects.enqueue(
                 event.event,
                 event.resource_type,
                 event.resource_id,
                 operation_ref,
                 event.data
               )
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
end
