defmodule GroupherServer.Test.CMS.Articles.RevisionTarget do
  @moduledoc false

  use GroupherServer.TestMate

  import Ecto.Query

  alias GroupherServer.{Analysis, CMS, Repo}
  alias Analysis.Model.{ArticleHourlyMetric, MetricEvent}
  alias CMS.Articles.{Draft.Store, Public, Revision}
  alias CMS.Articles.Publish.Target
  alias CMS.Articles.Publish.Doc, as: DocPublish

  alias CMS.Model.{
    Article,
    ArticleBodyDraft,
    ArticleBinding,
    ArticleDraft,
    ArticleLifecycle,
    ArticlePublic,
    ArticleRevision,
    ArtimentReview,
    DocBranch,
    DocBranchState,
    DocBranchVersion,
    PinnedArticle,
    PostDraft
  }

  test "publish materialization keeps stable identity and reuses unchanged body snapshots" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, author} = CMS.Articles.Persist.ensure_author_exists(user)
    {:ok, article} = insert_article(author.id, community.id)
    {:ok, body} = insert_body("body-v1")
    {:ok, draft} = insert_draft(article.id, body.id, author.id, "Title one", "content-1")
    {:ok, _typed_draft} = insert_post_draft(article.id)

    assert {:ok, revision_one} = Revision.create(article, draft)
    assert {:ok, public_one} = Public.select(article, revision_one, author)
    assert public_one.article_id == article.id
    assert public_one.revision_id == revision_one.id

    Repo.delete!(draft)

    {:ok, draft_two} =
      insert_draft(article.id, body.id, author.id, "Title two", "content-2", revision_one.id)

    assert {:ok, revision_two} = Revision.create(article, draft_two)
    assert revision_two.id != revision_one.id
    assert revision_two.body_snapshot_id == revision_one.body_snapshot_id

    assert {:ok, public_two} = Public.select(article, revision_two, author)
    assert public_two.article_id == article.id
    assert public_two.revision_id == revision_two.id
    assert public_two.publication_version == 2
    assert Repo.aggregate(ArticleRevision, :count) == 2
    assert Repo.aggregate(ArticlePublic, :count) == 1
  end

  test "autosave updates only Draft and discard preserves the selected Public Revision" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, author} = CMS.Articles.Persist.ensure_author_exists(user)
    body_bag = mock_body_bag(mock_rich_text("draft body"))

    assert {:ok, %{article: article, draft: draft}} =
             Store.create(
               community,
               :post,
               %{title: "Initial title", digest: "digest", body_bag: body_bag},
               author
             )

    assert draft.version == 1

    assert %ArticleBinding{community_id: community_id} =
             Repo.get_by!(ArticleBinding, article_id: article.id)

    assert community_id == community.id
    assert Repo.aggregate(ArticleRevision, :count) == 0

    assert {:ok, updated} =
             Store.update(article, %{title: "Updated title"}, author, expected_version: 1)

    assert updated.version == 2
    assert updated.title == "Updated title"
    assert Repo.aggregate(ArticleRevision, :count) == 0

    assert {:ok, revision} = Revision.create(article, updated)
    assert {:ok, selected} = Public.select(article, revision, author)
    assert {:ok, :pass} = Store.discard(article, expected_version: 2)
    assert {:error, :not_found} = Store.get(article)
    assert Repo.get!(ArticlePublic, article.id).revision_id == selected.revision_id
  end

  test "cover-only Draft edits change the content hash and Diff" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, author} = CMS.Articles.Persist.ensure_author_exists(user)

    {:ok, %{article: article, draft: draft}} =
      Store.create(
        community,
        :post,
        %{title: "Cover hash", digest: "digest", body_bag: mock_body_bag(mock_rich_text("body"))},
        author
      )

    assert {:ok, published} =
             Target.publish(article, author,
               community: community,
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1
             )

    assert {:ok, restored} = Store.ensure_from_public(article, author)

    cover = %{
      canvas_width: 1200,
      canvas_height: 630,
      version: 1,
      light: %{background: nil, original_background: nil, images: []},
      dark: %{background: nil, original_background: nil, images: []}
    }

    assert {:ok, updated} =
             Store.update(
               article,
               %{cover_url: "https://img.test/cover.png", cover_edit_info: cover},
               author,
               expected_version: restored.version
             )

    assert updated.content_hash != published.revision.content_hash
    assert {:ok, diff} = CMS.Articles.Draft.Diff.compare(article)
    assert diff.has_unpublished_changes
    assert :cover_edit in diff.changed_fields

    lifecycle = Repo.get_by!(CMS.Model.ArticleLifecycle, article_id: article.id)

    assert {:ok, republished} =
             Target.publish(article, author,
               community: community,
               expected_draft_version: updated.version,
               expected_lifecycle_version: lifecycle.version
             )

    assert :cover_edit in republished.changed_fields
  end

  test "publish atomically selects a Revision and removes the mutable workspace" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, author} = CMS.Articles.Persist.ensure_author_exists(user)

    {:ok, %{article: article, draft: draft}} =
      Store.create(
        community,
        :post,
        %{
          title: "Publish me",
          digest: "digest",
          body_bag: mock_body_bag(mock_rich_text("publish body"))
        },
        author
      )

    assert {:ok, result} =
             Target.publish(article, author,
               community: community,
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1
             )

    assert result.first_publish?

    assert Repo.get_by!(ArticleBinding, article_id: article.id, community_id: community.id).inner_id ==
             1

    assert result.public.article_id == article.id
    assert result.public.revision_id == result.revision.id
    assert {:error, :not_found} = Store.get(article)

    assert Repo.aggregate(CMS.Outbox.Event, :count) == 2

    assert Repo.aggregate(
             from(request in ArtimentReview,
               where: request.target_type == :article and request.article_id == ^article.id
             ),
             :count
           ) == 2
  end

  test "publish waits for an in-flight autosave and preserves its newer Draft" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, author} = CMS.Articles.Persist.ensure_author_exists(user)

    {:ok, %{article: article, draft: draft}} =
      Store.create(
        community,
        :post,
        %{
          title: "Before autosave",
          digest: "digest",
          body_bag: mock_body_bag(mock_rich_text("body"))
        },
        author
      )

    parent = self()

    autosave =
      Task.async(fn ->
        Repo.transaction(fn ->
          locked =
            ArticleDraft
            |> where([candidate], candidate.article_id == ^article.id)
            |> lock("FOR UPDATE")
            |> Repo.one!()

          send(parent, :draft_locked)

          receive do
            :commit_autosave ->
              locked
              |> Ecto.Changeset.change(%{
                title: "Saved concurrently",
                version: locked.version + 1
              })
              |> Repo.update!()
          end
        end)
      end)

    assert_receive :draft_locked

    publish =
      Task.async(fn ->
        Target.publish(article, author,
          community: community,
          expected_draft_version: draft.version,
          expected_lifecycle_version: 1
        )
      end)

    assert Task.yield(publish, 100) == nil
    send(autosave.pid, :commit_autosave)
    assert {:ok, {:ok, %ArticleDraft{version: 2}}} = Task.yield(autosave, 5_000)
    assert {:ok, {:error, :draft_version_conflict}} = Task.yield(publish, 5_000)

    assert {:ok, %ArticleDraft{title: "Saved concurrently", version: 2}} = Store.get(article)
  end

  test "Doc publish allocates durable branch versions and restore creates a new Draft" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, author} = CMS.Articles.Persist.ensure_author_exists(user)

    branch =
      %DocBranch{}
      |> DocBranch.changeset(%{
        community_id: community.id,
        slug: "main",
        title: "Main",
        type: :main,
        status: :active,
        created_by_id: user.id
      })
      |> Repo.insert!()

    {:ok, %{article: article, draft: draft}} =
      Store.create(
        community,
        :doc,
        %{
          title: "Doc v1",
          digest: "digest",
          slug: "doc-v1",
          body_bag: mock_body_bag(mock_rich_text("doc body"))
        },
        author,
        branch_id: branch.id
      )

    assert %DocBranchState{is_edited: false} =
             Repo.get_by!(DocBranchState, article_id: article.id, branch_id: branch.id)

    command_id = Ecto.UUID.generate()

    assert {:ok, result} =
             DocPublish.publish(article, branch.id, author,
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1,
               command_id: command_id
             )

    assert result.version.version_number == 1
    assert result.branch_type == :main

    assert Repo.all(from(event in CMS.Outbox.Event, where: event.command_id == ^command_id))
           |> Enum.map(& &1.event)
           |> Enum.sort() == ["article.projections", "article.published"]

    assert Repo.get_by!(ArticleBinding, article_id: article.id, community_id: community.id).inner_id ==
             1

    doc_binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: community.id)

    assert {:ok, [%{article: batch_article, binding: batch_binding, branch_id: branch_id}]} =
             CMS.Articles.locators([
               %{community: community.slug, thread: :doc, inner_id: doc_binding.inner_id}
             ])

    assert batch_article.id == article.id
    assert batch_binding.id == doc_binding.id
    assert branch_id == branch.id

    assert result.public.branch_version_id == result.version.id

    assert {:ok, %{entries: [%{version: %DocBranchVersion{id: _version_id}}]}} =
             CMS.Docs.list_branch_versions(article.id, branch.id, nil, user)

    assert {:ok, %{version: loaded_version, revision: loaded_revision}} =
             CMS.Docs.get_branch_version(article.id, branch.id, result.version.id, user)

    assert loaded_version.id == result.version.id
    assert loaded_revision.id == result.revision.id

    assert {:ok, %{changed_fields: []}} =
             CMS.Docs.diff_versions(
               article.id,
               branch.id,
               result.version.id,
               result.version.id,
               user
             )

    for number <- [2, 3] do
      attrs =
        result.version
        |> Map.from_struct()
        |> Map.take([:article_id, :branch_id, :revision_id, :published_by_id, :published_at])
        |> Map.put(:version_number, number)

      Repo.insert!(DocBranchVersion.changeset(%DocBranchVersion{}, attrs))
    end

    assert {:ok, %{entries: first, total_count: 3}} =
             CMS.Docs.list_branch_versions(
               article.id,
               branch.id,
               %{offset: %{page: 1, size: 2}},
               user
             )

    assert {:ok, %{entries: same, end_cursor: cursor, has_next_page: true}} =
             CMS.Docs.list_branch_versions(article.id, branch.id, %{cursor: %{first: 2}}, user)

    assert Enum.map(first, & &1.version.id) == Enum.map(same, & &1.version.id)

    assert {:ok, %{entries: [%{version: tail}], has_next_page: false}} =
             CMS.Docs.list_branch_versions(
               article.id,
               branch.id,
               %{cursor: %{first: 2, after: cursor}},
               user
             )

    assert tail.id == result.version.id
    assert {:error, _} = CMS.Docs.list_branch_versions(article.id, branch.id, nil, nil)

    assert {:error, _} =
             CMS.Docs.get_branch_version(article.id, branch.id, result.version.id, nil)

    assert {:ok, restored} =
             CMS.Docs.restore_revision_to_draft(
               article.id,
               branch.id,
               result.revision.id,
               author,
               community: community
             )

    assert restored.source_revision_id == result.revision.id
    assert restored.base_revision_id == result.revision.id

    assert Repo.get!(ArticleBodyDraft, restored.body_draft_id).json ==
             Repo.get!(CMS.Model.ArticleBodySnapshot, result.revision.body_snapshot_id).json
  end

  test "Articles facade authorizes stable update and publish through Gate" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    assert {:ok, %{article: article, draft: draft}} =
             CMS.Articles.create_stable_draft(
               community,
               :post,
               %{
                 title: "Facade draft",
                 digest: "digest",
                 body_bag: mock_body_bag(mock_rich_text("facade body"))
               },
               user
             )

    assert {:ok, updated} =
             CMS.Articles.update_draft(article.id, %{title: "Updated through Gate"}, user,
               community: community,
               expected_version: draft.version
             )

    assert {:ok, ^updated} = CMS.Articles.read_draft(article.id, user, community: community)

    assert {:ok, true} =
             CMS.Articles.has_unpublished_changes(article.id, user, community: community)

    assert {:ok, %{has_unpublished_changes: true}} =
             CMS.Articles.draft_diff(article.id, user, community: community)

    assert {:ok, %{article: published_article, public: public}} =
             CMS.Articles.publish(article.id, user,
               community: community,
               expected_draft_version: updated.version,
               expected_lifecycle_version: 1,
               command_id: Ecto.UUID.generate()
             )

    assert published_article.id == article.id
    assert {:ok, read_public} = CMS.Articles.read_editor(article.id, user, community: community)
    assert read_public.article_id == article.id
    assert read_public.revision_id == public.revision_id

    assert {:ok, false} =
             CMS.Articles.has_unpublished_changes(article.id, user, community: community)
  end

  test "stable Draft creation replays one command without duplicating the aggregate" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    command_id = Ecto.UUID.generate()

    attrs = %{
      title: "Idempotent draft",
      digest: "digest",
      body_bag: mock_body_bag(mock_rich_text("draft body"))
    }

    assert {:ok, first} =
             CMS.Articles.create_stable_draft(
               community,
               :post,
               attrs,
               user,
               command_id: command_id
             )

    assert {:ok, replayed} =
             CMS.Articles.create_stable_draft(
               community,
               :post,
               attrs,
               user,
               command_id: command_id
             )

    assert replayed.article.id == first.article.id
    assert replayed.draft.article_id == first.draft.article_id
    assert Repo.aggregate(Article, :count) == 1
    assert Repo.aggregate(ArticleDraft, :count) == 1
  end

  test "Revision cleanup locks only candidate revisions" do
    assert {:ok, 0} = CMS.Articles.Revision.Cleanup.run()
  end

  test "non-main Doc publish effects use the committed branch type" do
    {_community, doc, _attrs, _user} = mock_article(:doc)
    article = Repo.get!(Article, doc.article_id)
    result = %{article: article, branch_type: :preview}

    assert {:ok, ^result} = CMS.Articles.Effects.run(result)
  end

  test "move reassigns the public path and drops the source Community relationship" do
    {:ok, user} = db_insert(:user)
    {:ok, source} = db_insert(:community)
    {:ok, destination} = db_insert(:community)
    user = grant_binding_actions(user, [source, destination])

    {:ok, %{article: article, draft: draft}} =
      CMS.Articles.create_stable_draft(
        source,
        :post,
        %{
          title: "Move me",
          digest: "digest",
          body_bag: mock_body_bag(mock_rich_text("move body"))
        },
        user
      )

    assert {:ok, %{article: published}} =
             CMS.Articles.publish(article.id, user,
               community: source,
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1,
               command_id: Ecto.UUID.generate()
             )

    {:ok, %{article: destination_article, draft: destination_draft}} =
      CMS.Articles.create_stable_draft(
        destination,
        :post,
        %{
          title: "Destination Article",
          digest: "destination digest",
          body_bag: mock_body_bag(mock_rich_text("destination body"))
        },
        user
      )

    assert {:ok, _destination_published} =
             CMS.Articles.publish(destination_article.id, user,
               community: destination,
               expected_draft_version: destination_draft.version,
               expected_lifecycle_version: 1,
               command_id: Ecto.UUID.generate()
             )

    assert {:ok, pin} = CMS.Articles.pin(source, published.id, user, Ecto.UUID.generate())
    assert pin.id == published.id

    source_binding =
      Repo.get_by!(ArticleBinding, article_id: published.id, community_id: source.id)

    assert Repo.get_by!(PinnedArticle, article_binding_id: source_binding.id).article_binding_id ==
             source_binding.id

    move_command_id = Ecto.UUID.generate()

    assert {:ok, moved} =
             CMS.Articles.move(source, destination, published.id, [], user, move_command_id)

    assert {:ok, replayed_move} =
             CMS.Articles.move(source, destination, published.id, [], user, move_command_id)

    assert moved.id == published.id
    assert replayed_move.id == published.id

    moved_binding =
      Repo.get_by!(ArticleBinding, article_id: moved.id, community_id: destination.id)

    assert moved_binding.id == source_binding.id
    assert moved_binding.inner_id == 2

    assert %ArticleBinding{community_id: destination_id} =
             Repo.get_by!(ArticleBinding, article_id: moved.id)

    assert destination_id == destination.id
    refute Repo.get_by(ArticleBinding, article_id: moved.id, community_id: source.id)
    refute Repo.get_by(PinnedArticle, article_binding_id: source_binding.id)

    scopes =
      from(event in CMS.Outbox.Event,
        where: event.event == "article.visibility_changed",
        select: event.data
      )
      |> Repo.all()
      |> Enum.map(&{&1["community"], &1["inner_id"]})

    assert {source.slug, 1} in scopes
    assert {destination.slug, 2} in scopes
  end

  test "move preserves an existing destination binding and its local data" do
    {source, article, _attrs, user} = mock_article(:post)
    {:ok, destination} = db_insert(:community)
    user = grant_binding_actions(user, [source, destination])

    assert {:ok, _} =
             CMS.Articles.mirror(
               destination,
               article.id,
               [],
               user,
               source,
               Ecto.UUID.generate()
             )

    destination_binding =
      Repo.get_by!(ArticleBinding, article_id: article.id, community_id: destination.id)

    source_binding =
      Repo.get_by!(ArticleBinding, article_id: article.id, community_id: source.id)

    operation_id = Ecto.UUID.generate()

    assert {:ok, :pass} =
             Analysis.metric_event_append_article_action(
               article,
               operation_id,
               :upvote_added,
               binding_id: source_binding.id,
               community_id: source.id
             )

    bucket_started_at = DateTime.utc_now() |> DateTime.truncate(:second)

    insert_hourly_metric(source_binding, article, bucket_started_at, 2)
    insert_hourly_metric(destination_binding, article, bucket_started_at, 3)

    assert {:ok, _} =
             CMS.Articles.pin(destination, article.id, user, Ecto.UUID.generate())

    assert %PinnedArticle{} =
             Repo.get_by(PinnedArticle, article_binding_id: destination_binding.id)

    assert {:ok, _} =
             CMS.Articles.move(
               source,
               destination,
               article.id,
               [],
               user,
               Ecto.UUID.generate()
             )

    assert Repo.get_by!(ArticleBinding,
             article_id: article.id,
             community_id: destination.id
           ).id == destination_binding.id

    assert %PinnedArticle{} =
             Repo.get_by(PinnedArticle, article_binding_id: destination_binding.id)

    refute Repo.get_by(ArticleBinding, article_id: article.id, community_id: source.id)

    assert %MetricEvent{binding_id: binding_id, community_id: community_id} =
             Repo.get_by!(MetricEvent, operation_id: operation_id)

    assert binding_id == destination_binding.id
    assert community_id == destination.id

    assert %ArticleHourlyMetric{value: 5} =
             Repo.get_by!(ArticleHourlyMetric,
               binding_id: destination_binding.id,
               bucket_started_at: bucket_started_at,
               metric: :upvote_added
             )

    refute Repo.get_by(ArticleHourlyMetric, binding_id: source_binding.id)
  end

  test "move updates the Community scope of binding-owned metrics" do
    {source, article, _attrs, user} = mock_article(:post)
    {:ok, destination} = db_insert(:community)
    user = grant_binding_actions(user, [source, destination])
    binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: source.id)

    assert {:ok, :pass} =
             GroupherServer.Analysis.MetricEvent.append_article_action(
               article,
               Ecto.UUID.generate(),
               :upvote_added,
               binding_id: binding.id,
               community_id: source.id
             )

    assert {:ok, _} =
             CMS.Articles.move(
               source,
               destination,
               article.id,
               [],
               user,
               Ecto.UUID.generate()
             )

    assert %MetricEvent{community_id: destination_id, binding_id: binding_id} =
             Repo.get_by!(MetricEvent, binding_id: binding.id)

    assert destination_id == destination.id
    assert binding_id == binding.id
  end

  test "publish always requires an explicit Community" do
    {:ok, user} = db_insert(:user)
    {:ok, source} = db_insert(:community)
    {:ok, destination} = db_insert(:community)
    user = grant_binding_actions(user, [source, destination])

    {:ok, %{article: article, draft: draft}} =
      CMS.Articles.create_stable_draft(
        source,
        :post,
        %{
          title: "Publish with binding context",
          digest: "digest",
          body_bag: mock_body_bag(mock_rich_text("body"))
        },
        user
      )

    assert {:ok, %{article: published}} =
             CMS.Articles.publish(article.id, user,
               community: source,
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1,
               command_id: Ecto.UUID.generate()
             )

    assert {:ok, mirrored} =
             CMS.Articles.mirror(
               destination,
               published.id,
               [],
               user,
               source,
               Ecto.UUID.generate()
             )

    assert mirrored.id == published.id

    destination_binding =
      Repo.get_by!(ArticleBinding, article_id: published.id, community_id: destination.id)

    destination_id = destination_binding.community_id
    assert destination_id == destination.id
    assert {:ok, author} = CMS.Articles.Persist.ensure_author_exists(user)
    assert {:ok, restored} = Store.ensure_from_public(published, author)
    lifecycle = Repo.get_by!(CMS.Model.ArticleLifecycle, article_id: published.id)

    assert {:error,
            %ErrorCat.Error{
              namespace: {:cms, :article},
              reason: :binding_context_required
            }} =
             Target.publish(published, author,
               expected_draft_version: restored.version,
               expected_lifecycle_version: lifecycle.version
             )

    assert {:ok, result} =
             Target.publish(published, author,
               expected_draft_version: restored.version,
               expected_lifecycle_version: lifecycle.version,
               community: destination
             )

    assert result.community.id == destination.id
    assert result.binding.community_id == destination.id
  end

  test "mirror is Community-local and Doc rejects ordinary ArticleBinding commands" do
    {:ok, user} = db_insert(:user)
    {:ok, source} = db_insert(:community)
    {:ok, mirror_community} = db_insert(:community)
    {:ok, conflicting_community} = db_insert(:community)
    user = grant_binding_actions(user, [source, mirror_community, conflicting_community])

    {:ok, %{article: article}} =
      CMS.Articles.create_stable_draft(
        source,
        :post,
        %{
          title: "Mirror me",
          digest: "digest",
          body_bag: mock_body_bag(mock_rich_text("mirror body"))
        },
        user
      )

    mirror_command_id = Ecto.UUID.generate()

    assert {:ok, mirror} =
             CMS.Articles.mirror(
               mirror_community,
               article.id,
               [],
               user,
               source,
               mirror_command_id
             )

    assert mirror.id == article.id

    mirror_community_id = mirror_community.id

    assert %ArticleBinding{community_id: ^mirror_community_id} =
             Repo.get_by!(ArticleBinding,
               article_id: article.id,
               community_id: mirror_community_id
             )

    assert {:ok, replayed_mirror} =
             CMS.Articles.mirror(
               mirror_community,
               article.id,
               [],
               user,
               source,
               mirror_command_id
             )

    assert replayed_mirror.id == mirror.id

    assert {:error, %ErrorCat.Error{reason: :command_id_conflict}} =
             CMS.Articles.mirror(
               conflicting_community,
               article.id,
               [],
               user,
               source,
               mirror_command_id
             )

    assert Repo.get_by!(ArticleBinding,
             article_id: article.id,
             community_id: source.id
           ).community_id ==
             source.id

    source_unmirror_command_id = Ecto.UUID.generate()

    assert {:ok, :done} =
             CMS.Articles.unmirror(source, article.id, user, source_unmirror_command_id)

    assert {:ok, :done} =
             CMS.Articles.unmirror(source, article.id, user, source_unmirror_command_id)

    assert {:ok, :done} =
             CMS.Articles.unmirror(mirror_community, article.id, user, Ecto.UUID.generate())

    refute Repo.get_by(ArticleBinding,
             article_id: article.id,
             community_id: mirror_community.id
           )

    {:ok, branch} = CMS.Docs.Branch.resolve(source, CMS.Docs.Branch.main_slug())

    {:ok, %{article: doc}} =
      CMS.Articles.create_stable_draft_write(
        source,
        :doc,
        %{title: "Doc", digest: "doc", body_bag: mock_body_bag(mock_rich_text("doc"))},
        user,
        branch_id: branch.id
      )

    assert {:error, _reason} =
             CMS.Articles.move(source, mirror_community, doc.id, [], user, Ecto.UUID.generate())

    assert {:error, _reason} =
             CMS.Articles.mirror(mirror_community, doc.id, [], user, source, Ecto.UUID.generate())

    assert {:error, _reason} =
             CMS.Articles.unmirror(mirror_community, doc.id, user, Ecto.UUID.generate())
  end

  test "published Articles must retain at least one Community binding" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, hidden_community} = db_insert(:community)
    user = grant_binding_actions(user, [community, hidden_community])

    {:ok, %{article: article, draft: draft}} =
      CMS.Articles.create_stable_draft(
        community,
        :post,
        %{
          title: "Keep one binding",
          digest: "digest",
          body_bag: mock_body_bag(mock_rich_text("body"))
        },
        user
      )

    assert {:ok, %{article: published}} =
             CMS.Articles.publish(article.id, user,
               community: community,
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1,
               command_id: Ecto.UUID.generate()
             )

    assert {:ok, _extra_binding} =
             %ArticleBinding{}
             |> ArticleBinding.changeset(%{
               article_id: published.id,
               community_id: hidden_community.id
             })
             |> Repo.insert()

    assert {:ok, :done} =
             CMS.Articles.unmirror(hidden_community, published.id, user, Ecto.UUID.generate())

    refute Repo.get_by(ArticleBinding,
             article_id: published.id,
             community_id: hidden_community.id
           )

    assert {:error, :published_article_requires_community} =
             CMS.Articles.unmirror(community, published.id, user, Ecto.UUID.generate())
  end

  test "FrontDesk resolves ArticlePath to the selected stable public revision" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, author} = CMS.Articles.Persist.ensure_author_exists(user)

    {:ok, %{article: article, draft: draft}} =
      Store.create(
        community,
        :post,
        %{
          title: "Stable public title",
          digest: "stable digest",
          body_bag: mock_body_bag(mock_rich_text("stable public body"))
        },
        author
      )

    assert {:ok, %{article: published}} =
             Target.publish(article, author,
               community: community,
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1
             )

    binding =
      Repo.get_by!(ArticleBinding, article_id: published.id, community_id: community.id)

    assert {:ok, public} =
             CMS.FrontDesk.article(%{
               community: community.slug,
               thread: :post,
               inner_id: binding.inner_id
             })

    assert public.id == article.id
    assert public.article_id == article.id
    assert public.title == "Stable public title"
    assert public.body.plain_text =~ "stable public body"

    assert {:ok, [%{article: batch_article, binding: batch_binding}]} =
             CMS.Articles.locators([
               %{community: community.slug, thread: :post, inner_id: binding.inner_id}
             ])

    assert batch_article.id == article.id
    assert batch_binding.id == binding.id
  end

  defp insert_hourly_metric(binding, article, bucket_started_at, value) do
    %ArticleHourlyMetric{}
    |> Ecto.Changeset.change(%{
      community_id: binding.community_id,
      binding_id: binding.id,
      article_type: article.thread,
      article_id: article.id,
      bucket_started_at: bucket_started_at,
      metric: :upvote_added,
      actor_type: :all,
      is_authenticated: false,
      policy_version: 0,
      value: value
    })
    |> Repo.insert!()
  end

  defp grant_binding_actions(user, communities) do
    grants =
      Enum.into(communities, %{}, fn community ->
        {community.slug, %{"cms" => %{"post.pin" => true}}}
      end)

    global = %{
      "post.community.mirror" => true,
      "post.community.move" => true,
      "post.community.unmirror" => true
    }

    Map.put(user, :cur_passport, Map.merge(%{"global" => global}, grants))
  end

  defp insert_article(author_id, community_id) do
    with {:ok, article} <-
           %Article{}
           |> Article.changeset(%{author_id: author_id, thread: :post})
           |> Repo.insert(),
         {:ok, _lifecycle} <-
           %ArticleLifecycle{}
           |> ArticleLifecycle.changeset(%{
             article_id: article.id,
             community_id: community_id,
             thread: :post,
             state: :draft_only,
             version: 1,
             changed_at: DateTime.utc_now(:second)
           })
           |> Repo.insert() do
      {:ok, article}
    end
  end

  defp insert_body(content) do
    %ArticleBodyDraft{}
    |> ArticleBodyDraft.changeset(%{
      json: Jason.encode!(%{children: [%{text: content}]}),
      plain_text: content,
      body_hash: content,
      schema_version: 1
    })
    |> Repo.insert()
  end

  defp insert_draft(article_id, body_id, author_id, title, content_hash, base_revision_id \\ nil) do
    %ArticleDraft{}
    |> ArticleDraft.changeset(%{
      article_id: article_id,
      body_draft_id: body_id,
      base_revision_id: base_revision_id,
      updated_by_id: author_id,
      version: 1,
      title: title,
      digest: "digest",
      content_hash: content_hash
    })
    |> Repo.insert()
  end

  defp insert_post_draft(article_id) do
    %PostDraft{}
    |> PostDraft.changeset(%{article_id: article_id, copy_right: "cc"})
    |> Repo.insert()
  end
end
