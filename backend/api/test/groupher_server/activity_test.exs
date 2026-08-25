defmodule GroupherServer.Test.ActivityTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.Activity
  alias GroupherServer.Activity.Artiment
  alias GroupherServer.Activity.Const, as: ActivityConst

  alias GroupherServer.Activity.Model.{
    BlogLog,
    ChangelogLog,
    CommunityLog,
    DocLog,
    DocTreeLog,
    PostLog,
    PressLog
  }

  alias GroupherServer.CMS.Artiment.Threads
  alias GroupherServer.CMS.Model.{Comment, PressConfig}

  test "routes abstract Articles, rejects invalid contracts and deduplicates event refs" do
    {_community, post, _attrs, user} = mock_article(:post)
    {_blog_community, blog, _attrs, _blog_user} = mock_article(:blog)

    assert Repo.get_by!(PostLog, post_ref: post.article_hash_id, action: :created)
    assert Repo.get_by!(BlogLog, blog_ref: blog.article_hash_id, action: :created)

    assert {:error, _} = Activity.log(post, :released, actor: user)

    assert {:error, %ErrorCat.Error{reason: :invalid_action}} =
             Activity.log(post, "created", actor: user)

    assert {:error, %ErrorCat.Error{reason: :invalid_action}} =
             Activity.Post.log(post, "created", actor: user)

    assert {:error, _} = Activity.log(post, :created, actor: user, metadata: %{secret: "x"})

    event_ref = Ecto.UUID.generate()
    operation_ref = Ecto.UUID.generate()

    assert {:ok, _} =
             Activity.log(post, :restored,
               actor: user,
               event_ref: event_ref,
               operation_ref: operation_ref
             )

    assert {:error, %ErrorCat.Error{reason: :duplicate_event}} =
             Activity.log(post, :restored,
               actor: user,
               event_ref: event_ref,
               operation_ref: operation_ref
             )

    derived_operation_ref = Ecto.UUID.generate()

    assert {:ok, first} =
             Activity.log(post, :restored,
               actor: user,
               operation_ref: derived_operation_ref
             )

    assert {:error, %ErrorCat.Error{reason: :duplicate_event}} =
             Activity.log(post, :restored,
               actor: user,
               operation_ref: derived_operation_ref
             )

    assert {:ok, second} =
             Activity.log(post, :restored,
               actor: user,
               operation_ref: derived_operation_ref,
               operation_index: 1
             )

    assert first.operation_ref == second.operation_ref
    refute first.event_ref == second.event_ref

    snapshot_operation_ref = Ecto.UUID.generate()

    changing_resource = %{
      thread: :post,
      community_id: post.community_id,
      article_hash_id: Ecto.UUID.generate(),
      title: "title before retry"
    }

    assert {:ok, stable} =
             Activity.log(changing_resource, :created,
               actor: user,
               operation_ref: snapshot_operation_ref
             )

    assert {:error, %ErrorCat.Error{reason: :duplicate_event}} =
             Activity.log(%{changing_resource | title: "title changed before retry"}, :created,
               actor: user,
               operation_ref: snapshot_operation_ref
             )

    assert Repo.get_by!(PostLog, event_ref: stable.event_ref).stream_snapshot["title"] ==
             "title before retry"

    assert {:error, %ErrorCat.Error{reason: :invalid_actor}} =
             Activity.log(post, :restored, actor: nil)

    assert {:error, %ErrorCat.Error{reason: :invalid_actor}} =
             Activity.log(post, :restored, actor: :operations)

    assert {:ok, system_event} = Activity.log(post, :restored)
    assert system_event.actor_type == :system
    assert system_event.actor_ref == "groupher"
    assert system_event.outcome == :allowed
    assert system_event.denial_code == nil
    assert system_event.operation_index == 0
    assert is_integer(system_event.record_sequence)
    assert %DateTime{} = system_event.recorded_at

    assert {:ok, changed_event} =
             Activity.log(post, :title_changed,
               actor: user,
               payload: %{title: "changed"},
               changed_fields: [:title]
             )

    assert changed_event.actor_ref == user.login
    assert changed_event.changed_fields == ["title"]

    assert {:ok, child_event} =
             Activity.log(post, :restored,
               actor: user,
               parent_event_ref: stable.event_ref
             )

    assert child_event.parent_event_ref == stable.event_ref

    assert {:ok, _producer_owned_parent} =
             Activity.log(post, :restored,
               actor: user,
               parent_event_ref: Ecto.UUID.generate()
             )

    assert {:error, %ErrorCat.Error{reason: :invalid_parent_event_ref}} =
             Activity.log(post, :restored, actor: user, parent_event_ref: "not-a-uuid")
  end

  test "authenticated Gate denials append a denied Activity fact" do
    {community, post, _attrs, _owner} = mock_article(:post)
    {:ok, stranger} = db_insert(:user)

    assert {:ok, _lifecycle} =
             CMS.Articles.Lifecycle.transition(
               community.id,
               :post,
               post.article_hash_id,
               :archived
             )

    assert {:error, %CMS.Gate.Decision{primary: %{reason: :article_archived}}} =
             CMS.Articles.trash(post, stranger)

    denied = Repo.get_by!(PostLog, post_ref: post.article_hash_id, action: :trashed)
    assert denied.outcome == :denied
    assert denied.denial_code == "article_archived"
    assert denied.actor_type == :user
    assert denied.actor_ref == stranger.login
  end

  test "handler registry, Comment routing and surface contracts fail closed" do
    assert Artiment.handlers() |> Map.keys() |> Enum.sort() ==
             Threads.article_enums() |> Enum.sort()

    assert Activity.Changelog.contracts().release_rescheduled.producer_status == :contract_only
    assert Activity.Changelog.contracts().release_withdrawn.producer_status == :contract_only

    assert GroupherServer.Activity.Event.classification(:release_rescheduled).category ==
             :publishing

    assert GroupherServer.Activity.Event.classification(:moderation_review_started).category ==
             :moderation

    for {handler, actions} <- [
          {Activity.Post,
           [
             :comment_created,
             :comment_updated,
             :moderation_review_started,
             :moderation_review_resolved
           ]},
          {Activity.Blog,
           [
             :comment_created,
             :comment_updated,
             :moderation_review_started,
             :moderation_review_resolved
           ]},
          {Activity.Changelog,
           [
             :comment_created,
             :comment_updated,
             :moderation_review_started,
             :moderation_review_resolved
           ]},
          {Activity.Doc,
           [
             :draft_updated,
             :comment_created,
             :comment_updated,
             :moderation_review_started,
             :moderation_review_resolved
           ]}
        ],
        action <- actions do
      assert handler.contracts()[action].producer_status == :contract_only
    end

    {_community, post, _attrs, user} = mock_article(:post)

    comment = %Comment{
      thread: :post,
      article_hash_id: post.article_hash_id,
      community_id: post.community_id,
      inner_id: 42
    }

    assert {:ok, log} = Activity.log(comment, :comment_pinned, actor: user)
    assert log.post_ref == post.article_hash_id
    assert log.subject_type == "comment"
    assert log.subject_ref == "42"

    assert {:error, _} = Activity.log(%{thread: :unknown}, :created, actor: user)
    assert {:error, _} = Activity.log(post, :created, actor: user, source: :unknown)

    assert {:error, _} =
             Activity.log(post, :solution_accepted,
               actor: user,
               target: %{activity_type: :post, ref: "wrong-target"}
             )

    for handler <- Map.values(Artiment.handlers()),
        {_action, contract} <- handler.contracts(),
        {_surface, projection} <- contract.surfaces do
      assert MapSet.subset?(
               MapSet.new(projection.exposed_payload),
               MapSet.new(contract.write.accepted_payload)
             )

      assert MapSet.subset?(
               MapSet.new(projection.exposed_metadata),
               MapSet.new(contract.write.accepted_metadata)
             )
    end

    assert Ecto.Enum.values(PostLog, :source) == ActivityConst.source_values()
    assert Ecto.Enum.values(PostLog, :actor_type) == ActivityConst.actor_type_values()
  end

  test "contract_only actions remain writable and use their declared surface" do
    {community, post, _attrs, user} = mock_article(:post)

    assert {:ok, event} =
             Activity.log(post, :moderation_review_started,
               actor: user,
               metadata: %{case_ref: "review-case-1"}
             )

    assert event.action == :moderation_review_started
    assert Activity.Post.contracts().moderation_review_started.producer_status == :contract_only

    {:ok, manager} = db_insert(:user)

    manager = %{
      manager
      | cur_passport: %{"global" => %{}, community.slug => %{"root" => true}}
    }

    assert {:ok, result} = Activity.list_community_logs(community, manager, %{filter: %{}}, 1)

    refute Enum.any?(result.entries, &(&1.action == :moderation_review_started))
  end

  test "ArticleLog authorizes Article reads and projects only safe fields" do
    {_community, post, _attrs, _user} = mock_article(:post)

    assert {:ok, %{entries: entries, total_count: total_count}} =
             Activity.list_article_logs(post, nil, %{page: 1})

    assert total_count >= 1
    created = Enum.find(entries, &(&1.action == :created))
    assert created.id

    assert created.subject == %{
             type: :post,
             ref: post.article_hash_id,
             title: post.title,
             inner_id: post.inner_id
           }

    assert created.payload == %{}
    refute Map.has_key?(created, :metadata)
    refute Map.has_key?(created, :source)
  end

  test "ArticleLog keeps Article and Doc branch permissions, surface filtering and tie order" do
    {_community, post, _attrs, user} = mock_article(:post)
    occurred_at = DateTime.utc_now(:second)
    operation_ref = Ecto.UUID.generate()

    assert {:ok, older} =
             Activity.log(post, :restored,
               actor: user,
               occurred_at: occurred_at,
               operation_ref: operation_ref,
               operation_index: 0
             )

    assert {:ok, newer} =
             Activity.log(post, :restored,
               actor: user,
               occurred_at: occurred_at,
               operation_ref: operation_ref,
               operation_index: 1
             )

    assert {:ok, _} =
             Activity.log(post, :trashed, actor: user, occurred_at: occurred_at)

    assert {:ok, _} =
             Activity.log(post, :permanently_deleted, actor: user, occurred_at: occurred_at)

    assert {:ok, %{entries: entries}} = Activity.list_article_logs(post, nil)
    restored_ids = entries |> Enum.filter(&(&1.action == :restored)) |> Enum.map(& &1.id)
    assert Enum.take(restored_ids, 2) == [newer.event_ref, older.event_ref]
    refute Enum.any?(entries, &(&1.action in [:trashed, :permanently_deleted]))

    {doc_community, doc, _doc_attrs, doc_user} = mock_article(:doc)

    assert {:ok, doc_draft} =
             CMS.Articles.update_draft(
               doc_community,
               :doc,
               doc.article_hash_id,
               %{title: "branch-scoped draft", expected_version: doc.version},
               doc_user
             )

    assert doc_draft.branch_id
    assert {:ok, _} = Activity.list_article_logs(doc_draft, doc_user)
    assert {:error, _} = Activity.list_article_logs(doc_draft, nil)

    assert {:ok, _trashed} = CMS.Articles.trash(post, user)
    assert {:error, _} = Activity.list_article_logs(post, nil)
  end

  test "business state rolls back when its Activity append fails" do
    {community, _post, _attrs, user} = mock_article(:post)
    constraint = "press_logs_reject_activity_test"
    before_config = Repo.get_by(PressConfig, community_id: community.id)

    {:ok, effective_config} = CMS.Press.config(community)
    next_feed_enabled = not effective_config.feed_enabled

    Repo.query!("""
    ALTER TABLE activity.press_logs
    ADD CONSTRAINT #{constraint} CHECK (action <> 'config_updated') NOT VALID
    """)

    try do
      assert {:error, _} =
               CMS.Press.update_config(community, %{feed_enabled: next_feed_enabled}, user)

      assert Repo.get_by(PressConfig, community_id: community.id) == before_config
    after
      Repo.query!("ALTER TABLE activity.press_logs DROP CONSTRAINT #{constraint}")
    end
  end

  test "database CHECK constraints reject invalid Activity action and source" do
    {_community, post, _attrs, _user} = mock_article(:post)
    log = Repo.get_by!(PostLog, post_ref: post.article_hash_id, action: :created)

    declared_constraints =
      %PostLog{}
      |> PostLog.changeset(%{})
      |> Map.fetch!(:constraints)
      |> Enum.map(& &1.constraint)
      |> MapSet.new()

    assert MapSet.subset?(
             MapSet.new([
               "post_logs_action_check",
               "post_logs_source_check",
               "post_logs_actor_type_check",
               "post_logs_target_pair_check"
             ]),
             declared_constraints
           )

    for {field, value} <- [{"action", "not_declared"}, {"source", "not_declared"}] do
      assert {:error, %Postgrex.Error{}} =
               Repo.transaction(fn ->
                 case Repo.query(
                        "UPDATE activity.post_logs SET #{field} = $1 WHERE id = $2",
                        [value, log.id]
                      ) do
                   {:error, error} -> Repo.rollback(error)
                   {:ok, _} -> flunk("database accepted invalid Activity #{field}")
                 end
               end)
    end
  end

  test "migration CHECK values stay in parity with Activity schemas and Const" do
    schemas = [
      {"post_logs", PostLog},
      {"blog_logs", BlogLog},
      {"changelog_logs", ChangelogLog},
      {"doc_logs", DocLog},
      {"community_logs", CommunityLog},
      {"doc_tree_logs", DocTreeLog},
      {"press_logs", PressLog}
    ]

    expected_sources = Enum.map(ActivityConst.source_values(), &to_string/1)
    expected_actor_types = Enum.map(ActivityConst.actor_type_values(), &to_string/1)

    for {table, schema} <- schemas do
      assert check_values(table, :source) == expected_sources
      assert check_values(table, :actor_type) == expected_actor_types

      expected_actions = Ecto.Enum.values(schema, :action) |> Enum.map(&to_string/1)
      assert check_values(table, :action) == expected_actions
    end

    for handler <- Activity.CommunityLog.handlers(),
        {action, contract} <- handler.contracts(),
        Map.has_key?(contract.surfaces, :community_log),
        contract.producer_status == :active do
      assert contract.classification.category in [
               :content,
               :publishing,
               :lifecycle,
               :engagement,
               :moderation,
               :community
             ]

      assert is_boolean(contract.classification.high_risk),
             "missing classification for #{inspect({handler, action})}"

      assert String.starts_with?(contract.presentation.message_key, "activity."),
             "missing product copy key for #{inspect({handler, action})}"
    end
  end

  test "CommunityLog aggregates Community streams with audit.read and stable safe envelopes" do
    {community, post, _attrs, _owner} = mock_article(:post)
    {:ok, manager} = db_insert(:user)

    manager = %{
      manager
      | cur_passport: %{"global" => %{}, community.slug => %{"root" => true}}
    }

    occurred_at = DateTime.utc_now(:second)

    assert {:ok, _} =
             Activity.log(post, :restored,
               actor: manager,
               occurred_at: occurred_at
             )

    assert {:ok, _} =
             Activity.log(
               %{activity_type: :community, community_id: community.id, ref: community.slug},
               :activated,
               source: :worker,
               occurred_at: occurred_at,
               metadata: %{state: :active}
             )

    for thread <- [:blog, :changelog, :doc] do
      assert {:ok, _} =
               Activity.log(
                 %{
                   thread: thread,
                   community_id: community.id,
                   article_hash_id: Ecto.UUID.generate(),
                   title: "#{thread} activity"
                 },
                 :created,
                 occurred_at: occurred_at
               )
    end

    second_blog_ref = Ecto.UUID.generate()

    assert {:ok, second_blog} =
             Activity.log(
               %{
                 thread: :blog,
                 community_id: community.id,
                 article_hash_id: second_blog_ref,
                 title: "second blog activity"
               },
               :created,
               occurred_at: occurred_at
             )

    assert {:ok, _} =
             Activity.log(
               %{
                 activity_type: :doc_tree,
                 community_id: community.id,
                 ref: "tree-node"
               },
               :trashed,
               occurred_at: occurred_at,
               metadata: %{node_count: 1, doc_count: 1}
             )

    assert {:ok, _} =
             Activity.log(
               %{activity_type: :press, community_id: community.id, ref: community.slug},
               :config_updated,
               occurred_at: occurred_at,
               payload: %{feed_enabled: true},
               metadata: %{revision: 1}
             )

    assert {:ok, result} =
             Activity.list_community_logs(community, manager, %{filter: %{}}, 1)

    assert result.total_count >= 2

    assert result.entries
           |> Enum.map(& &1.resource.type)
           |> MapSet.new()
           |> MapSet.equal?(
             MapSet.new([:post, :blog, :changelog, :doc, :community, :doc_tree, :press])
           )

    assert Enum.any?(
             result.entries,
             &(&1.action == :created and &1.resource.ref == post.article_hash_id)
           )

    assert result.entries |> Enum.take(8) |> Enum.map(& &1.resource.type) == [
             :press,
             :doc_tree,
             :blog,
             :doc,
             :changelog,
             :blog,
             :community,
             :post
           ]

    assert Enum.at(result.entries, 2).id == second_blog.event_ref

    community_entry = Enum.find(result.entries, &(&1.action == :activated))
    assert community_entry.id == Repo.get_by!(CommunityLog, action: :activated).event_ref
    assert community_entry.metadata == %{state: "active"}
    assert community_entry.event_ref
    assert community_entry.operation_ref

    assert {:ok, blog_result} =
             Activity.list_community_logs(
               community,
               manager,
               %{filter: %{resource_types: [:blog]}},
               1
             )

    assert blog_result.total_count == 2
    assert Enum.all?(blog_result.entries, &(&1.resource.type == :blog))

    assert {:ok, press_result} =
             Activity.list_community_logs(
               community,
               manager,
               %{filter: %{resource_types: [:press], actions: [:config_updated]}},
               1
             )

    assert press_result.total_count == 1
    assert [%{action: :config_updated, resource: %{type: :press}}] = press_result.entries

    assert {:error, _} = Activity.list_community_logs(community, manager, %{filter: %{}}, 0)

    assert {:error, _} =
             Activity.list_community_logs(community, manager, %{filter: %{size: 20}}, 1)
  end

  test "CommunityLog uses fixed-size database pagination across pages" do
    {community, _post, _attrs, _owner} = mock_article(:post)
    {:ok, manager} = db_insert(:user)

    manager = %{
      manager
      | cur_passport: %{"global" => %{}, community.slug => %{"root" => true}}
    }

    base_time = DateTime.add(DateTime.utc_now(:second), -60, :second)

    for sequence <- 1..35 do
      assert {:ok, _} =
               Activity.log(
                 %{activity_type: :community, community_id: community.id, ref: community.slug},
                 :activated,
                 actor: manager,
                 occurred_at: DateTime.add(base_time, sequence, :second)
               )
    end

    assert {:ok, first_page} = Activity.list_community_logs(community, manager, %{filter: %{}}, 1)

    assert {:ok, second_page} =
             Activity.list_community_logs(community, manager, %{filter: %{}}, 2)

    assert first_page.page_size == 30
    assert length(first_page.entries) == 30
    assert second_page.entries != []
    assert first_page.total_count == second_page.total_count

    first_ids = MapSet.new(first_page.entries, & &1.id)
    second_ids = MapSet.new(second_page.entries, & &1.id)
    assert MapSet.disjoint?(first_ids, second_ids)
  end

  test "CommunityLog stats fill zero UTC day buckets and share list filters" do
    {community, _post, _attrs, owner} = mock_article(:post)
    {:ok, manager} = db_insert(:user)

    manager = %{
      manager
      | cur_passport: %{"global" => %{}, community.slug => %{"root" => true}}
    }

    start = DateTime.new!(Date.add(Date.utc_today(), -2), ~T[00:00:00], "Etc/UTC")

    assert {:ok, _} =
             Activity.log(
               %{activity_type: :community, community_id: community.id, ref: community.slug},
               :activated,
               actor: owner,
               occurred_at: start
             )

    assert {:ok, _} =
             Activity.log(
               %{activity_type: :community, community_id: community.id, ref: community.slug},
               :activated,
               actor: owner,
               occurred_at: DateTime.add(start, 2, :day)
             )

    before = DateTime.add(start, 3, :day)

    assert {:ok, stats} =
             Activity.get_community_log_stats(community, manager, %{
               filter: %{
                 occurred_after: start,
                 occurred_before: before,
                 actions: ["activated"]
               }
             })

    assert stats.granularity == :day
    assert stats.timezone == "Etc/UTC"
    assert stats.total_count == 2
    assert Enum.map(stats.buckets, & &1.count) == [1, 0, 1]

    assert {:ok, empty} =
             Activity.list_community_logs(community, manager, %{
               filter: %{resource_types: ["community"], actions: ["created"]}
             })

    assert empty.total_count == 0
  end

  test "CommunityLog projects parent event refs for detail relations" do
    {community, _post, _attrs, manager} = mock_article(:post)

    assert {:ok, parent} =
             Activity.log(
               %{activity_type: :community, community_id: community.id, ref: community.slug},
               :activated,
               actor: manager
             )

    assert {:ok, _child} =
             Activity.log(
               %{activity_type: :community, community_id: community.id, ref: community.slug},
               :setup_retried,
               actor: manager,
               parent_event_ref: parent.event_ref
             )

    {:ok, manager} = db_insert(:user)

    manager = %{
      manager
      | cur_passport: %{"global" => %{}, community.slug => %{"root" => true}}
    }

    assert {:ok, result} = Activity.list_community_logs(community, manager, %{filter: %{}}, 1)
    child = Enum.find(result.entries, &(&1.action == :setup_retried))
    assert child.parent_event_ref == parent.event_ref
  end

  test "CommunityLog detail reads parent and child events outside the current page" do
    {community, _post, _attrs, manager} = mock_article(:post)

    assert {:ok, parent} =
             Activity.log(
               %{activity_type: :community, community_id: community.id, ref: community.slug},
               :activated,
               actor: manager
             )

    assert {:ok, child} =
             Activity.log(
               %{activity_type: :community, community_id: community.id, ref: community.slug},
               :setup_retried,
               actor: manager,
               parent_event_ref: parent.event_ref
             )

    manager = %{
      manager
      | cur_passport: %{"global" => %{}, community.slug => %{"root" => true}}
    }

    assert {:ok, detail} = Activity.get_community_log_event(community, manager, child.event_ref)
    assert detail.event_ref == child.event_ref
    assert detail.parent_event.event_ref == parent.event_ref

    assert {:ok, parent_detail} =
             Activity.get_community_log_event(community, manager, parent.event_ref)

    assert [%{event_ref: child_ref}] = parent_detail.child_events
    assert child_ref == child.event_ref
  end

  test "CommunityLog rejects invalid and unbounded time windows" do
    {community, _post, _attrs, manager} = mock_article(:post)

    manager = %{
      manager
      | cur_passport: %{"global" => %{}, community.slug => %{"root" => true}}
    }

    after_datetime = DateTime.utc_now()
    before_datetime = DateTime.add(after_datetime, -1, :second)

    assert {:error, _} =
             Activity.list_community_logs(community, manager, %{
               filter: %{occurred_after: after_datetime, occurred_before: before_datetime}
             })

    assert {:error, _} =
             Activity.get_community_log_stats(community, manager, %{
               filter: %{
                 occurred_after: after_datetime,
                 occurred_before: DateTime.add(after_datetime, 367, :day)
               }
             })
  end

  test "CommunityLog exports the bounded filtered result as JSON and CSV" do
    {community, _post, _attrs, _owner} = mock_article(:post)
    {:ok, manager} = db_insert(:user)

    manager = %{
      manager
      | cur_passport: %{"global" => %{}, community.slug => %{"root" => true}}
    }

    assert {:ok, _} =
             Activity.log(
               %{activity_type: :community, community_id: community.id, ref: community.slug},
               :activated,
               actor: manager
             )

    filter = %{actions: ["activated"]}

    assert {:ok, json} =
             Activity.export_community_logs(community, manager, %{filter: filter}, :json)

    assert json.mime_type == "application/json"
    assert json.exported_count == 1
    assert json.content =~ "activated"
    assert json.manifest.schema_version == 3

    exported = Repo.get_by!(CommunityLog, action: :activity_exported)
    assert exported.actor_ref == manager.login
    assert exported.payload["exported_count"] == 1

    assert {:ok, csv} =
             Activity.export_community_logs(community, manager, %{filter: filter}, :csv)

    assert csv.mime_type == "text/csv"

    assert csv.content =~
             "event_ref,operation_ref,parent_event_ref,operation_index,record_sequence"

    assert csv.exported_count == 1
  end

  test "CommunityLog presets resolve to one applied filter and explain empty intersections" do
    {community, _post, _attrs, _owner} = mock_article(:post)
    {:ok, manager} = db_insert(:user)

    manager = %{
      manager
      | cur_passport: %{"global" => %{}, community.slug => %{"root" => true}}
    }

    assert {:ok, result} =
             Activity.list_community_logs(
               community,
               manager,
               %{
                 preset_key: "destructive_actions",
                 filter: %{actions: ["created"]}
               },
               1
             )

    assert result.entries == []
    assert result.query_context.preset.key == "destructive_actions"
    assert result.query_context.preset_intersection_empty
    assert %DateTime{} = result.query_context.applied_filter.occurred_after
    assert %DateTime{} = result.query_context.applied_filter.occurred_before

    assert {:error, %ErrorCat.Error{reason: :preset_unavailable}} =
             Activity.list_community_logs(
               community,
               manager,
               %{preset_key: "missing", filter: %{}},
               1
             )
  end

  test "CommunityLog export fails closed when its self-audit append fails" do
    {community, _post, _attrs, _owner} = mock_article(:post)
    {:ok, manager} = db_insert(:user)

    manager = %{
      manager
      | cur_passport: %{"global" => %{}, community.slug => %{"root" => true}}
    }

    constraint = "community_logs_reject_export_test"

    Repo.query!("""
    ALTER TABLE activity.community_logs
    ADD CONSTRAINT #{constraint} CHECK (action <> 'activity_exported') NOT VALID
    """)

    try do
      assert {:error, %ErrorCat.Error{reason: :append_failed}} =
               Activity.export_community_logs(
                 community,
                 manager,
                 %{filter: %{actions: ["activated"]}},
                 :json
               )
    after
      Repo.query!("ALTER TABLE activity.community_logs DROP CONSTRAINT #{constraint}")
    end
  end

  defp check_values(table, field) do
    constraint_name = "#{table}_#{field}_check"

    %{rows: [[definition]]} =
      Repo.query!(
        """
        SELECT pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conname = $1
        """,
        [constraint_name]
      )

    Regex.scan(~r/'([^']+)'/, definition, capture: :all_but_first)
    |> List.flatten()
  end
end
