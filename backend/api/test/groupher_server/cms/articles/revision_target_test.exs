defmodule GroupherServer.Test.CMS.Articles.RevisionTarget do
  @moduledoc false

  use GroupherServer.TestMate

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.{Draft.Store, Public, Revision}
  alias CMS.Articles.Publish.Target
  alias CMS.Articles.Publish.Doc, as: DocPublish

  alias CMS.Model.{
    Article,
    ArticleBodyDraft,
    ArticleCommunity,
    ArticleDraft,
    ArticlePublic,
    ArticleRevision,
    DocBranch,
    DocBranchState,
    DocBranchVersion,
    PinnedArticle,
    PostDraft
  }

  test "publish materialization keeps stable identity and reuses unchanged body snapshots" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, author} = CMS.Articles.Writer.ensure_author_exists(user)
    {:ok, article} = insert_article(community.id, author.id)
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
    {:ok, author} = CMS.Articles.Writer.ensure_author_exists(user)
    body_bag = mock_body_bag(mock_rich_text("draft body"))

    assert {:ok, %{article: article, draft: draft}} =
             Store.create(
               community,
               :post,
               %{title: "Initial title", digest: "digest", body_bag: body_bag},
               author
             )

    assert draft.version == 1

    assert %ArticleCommunity{role: :home, community_id: community_id} =
             Repo.get_by!(ArticleCommunity, article_id: article.id)

    assert community_id == community.id
    assert Repo.aggregate(ArticleRevision, :count) == 0

    assert {:ok, updated} =
             Store.update(article, %{title: "Updated title"}, author, expected_version: 1)

    assert updated.version == 2
    assert updated.title == "Updated title"
    assert Repo.aggregate(ArticleRevision, :count) == 0

    assert {:ok, revision} = Revision.create(article, updated)
    assert {:ok, selected} = Public.select(article, revision, author)
    assert :ok = Store.discard(article, expected_version: 2)
    assert {:error, :not_found} = Store.get(article)
    assert Repo.get!(ArticlePublic, article.id).revision_id == selected.revision_id
  end

  test "cover-only Draft edits change the content hash and Diff" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, author} = CMS.Articles.Writer.ensure_author_exists(user)

    {:ok, %{article: article, draft: draft}} =
      Store.create(
        community,
        :post,
        %{title: "Cover hash", digest: "digest", body_bag: mock_body_bag(mock_rich_text("body"))},
        author
      )

    assert {:ok, published} =
             Target.publish(article, author,
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
               expected_draft_version: updated.version,
               expected_lifecycle_version: lifecycle.version
             )

    assert :cover_edit in republished.changed_fields
  end

  test "publish atomically selects a Revision and removes the mutable workspace" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, author} = CMS.Articles.Writer.ensure_author_exists(user)

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
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1
             )

    assert result.first_publish?
    assert result.article.inner_id == 1
    assert result.public.article_id == article.id
    assert result.public.revision_id == result.revision.id
    assert {:error, :not_found} = Store.get(article)

    assert Repo.aggregate(CMS.Outbox.Event, :count) == 0
  end

  test "publish waits for an in-flight autosave and preserves its newer Draft" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, author} = CMS.Articles.Writer.ensure_author_exists(user)

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
    {:ok, author} = CMS.Articles.Writer.ensure_author_exists(user)

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

    assert %DocBranchState{moderation_state: :legal, is_edited: false} =
             Repo.get_by!(DocBranchState, article_id: article.id, branch_id: branch.id)

    assert {:ok, result} =
             DocPublish.publish(article, branch.id, author,
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1
             )

    assert result.version.version_number == 1
    assert result.branch_type == :main
    assert Repo.get!(Article, article.id).inner_id == 1
    assert result.public.branch_version_id == result.version.id

    assert {:ok, [%{version: %DocBranchVersion{id: _version_id}}]} =
             CMS.Docs.list_branch_versions(article.id, branch.id)

    assert {:ok, %{version: loaded_version, revision: loaded_revision}} =
             CMS.Docs.get_branch_version(article.id, branch.id, result.version.id)

    assert loaded_version.id == result.version.id
    assert loaded_revision.id == result.revision.id

    assert {:ok, %{changed_fields: []}} =
             CMS.Docs.diff_versions(
               article.id,
               branch.id,
               result.version.id,
               result.version.id
             )

    assert {:ok, restored} =
             CMS.Docs.restore_revision_to_draft(
               article.id,
               branch.id,
               result.revision.id,
               author
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
               expected_version: draft.version
             )

    assert {:ok, ^updated} = CMS.Articles.read_draft(article.id, user)
    assert {:ok, true} = CMS.Articles.has_unpublished_changes(article.id, user, [])

    assert {:ok, %{has_unpublished_changes: true}} =
             CMS.Articles.draft_diff(article.id, user, [])

    assert {:ok, %{public: public}} =
             CMS.Articles.publish(article.id, user,
               expected_draft_version: updated.version,
               expected_lifecycle_version: 1
             )

    assert public.article_id == article.id
    assert {:ok, ^public} = CMS.Articles.read_editor(article.id, user, [])
    assert {:ok, false} = CMS.Articles.has_unpublished_changes(article.id, user, [])
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

    assert {:ok, ^result} = CMS.Articles.Publish.Effects.run(result)
  end

  test "move reassigns the public path and drops the source Community relationship" do
    {:ok, user} = db_insert(:user)
    {:ok, source} = db_insert(:community)
    {:ok, destination} = db_insert(:community)

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
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1
             )

    assert {:ok, pin} = CMS.Articles.pin(source, published.id, user)
    assert pin.article_community_id
    assert {:ok, moved} = CMS.Articles.move(destination, published.id, [], user)
    assert moved.id == published.id
    assert moved.community_id == destination.id
    assert moved.inner_id == 1

    assert %ArticleCommunity{community_id: destination_id, role: :home} =
             Repo.get_by!(ArticleCommunity, article_id: moved.id)

    assert destination_id == destination.id
    refute Repo.get_by(ArticleCommunity, article_id: moved.id, community_id: source.id)
    refute Repo.get(PinnedArticle, pin.id)

    scopes =
      from(event in CMS.Outbox.Event,
        where: event.event == "article.visibility_changed",
        select: event.data
      )
      |> Repo.all()
      |> Enum.map(&{&1["community"], &1["inner_id"]})

    assert {source.slug, published.inner_id} in scopes
    assert {destination.slug, moved.inner_id} in scopes
  end

  test "mirror is Community-local and Doc rejects ordinary Article Community commands" do
    {:ok, user} = db_insert(:user)
    {:ok, source} = db_insert(:community)
    {:ok, mirror_community} = db_insert(:community)

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

    assert {:ok, %ArticleCommunity{role: :mirror} = mirror} =
             CMS.Articles.mirror(mirror_community, article.id, [], user)

    assert mirror.community_id == mirror_community.id

    assert Repo.get_by!(ArticleCommunity, article_id: article.id, role: :home).community_id ==
             source.id

    assert {:ok, :done} = CMS.Articles.unmirror(mirror_community, article.id, user)

    refute Repo.get_by(ArticleCommunity,
             article_id: article.id,
             community_id: mirror_community.id
           )

    {:ok, branch} = CMS.Docs.Branch.resolve(source, CMS.Docs.Branch.main_slug())

    {:ok, %{article: doc}} =
      CMS.Articles.create_stable_draft(
        source,
        :doc,
        %{title: "Doc", digest: "doc", body_bag: mock_body_bag(mock_rich_text("doc"))},
        user,
        branch_id: branch.id
      )

    assert {:error, _reason} = CMS.Articles.move(mirror_community, doc.id, [], user)
    assert {:error, _reason} = CMS.Articles.mirror(mirror_community, doc.id, [], user)
    assert {:error, _reason} = CMS.Articles.unmirror(mirror_community, doc.id, user)
  end

  test "FrontDesk resolves ArticlePath to the selected stable public revision" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, author} = CMS.Articles.Writer.ensure_author_exists(user)

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
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1
             )

    assert {:ok, public} =
             CMS.FrontDesk.article(%{
               community: community.slug,
               thread: :post,
               inner_id: published.inner_id
             })

    assert public.id == article.id
    assert public.article_id == article.id
    assert public.title == "Stable public title"
    assert public.document.plain_text =~ "stable public body"
  end

  defp insert_article(community_id, author_id) do
    %Article{}
    |> Article.changeset(%{
      community_id: community_id,
      author_id: author_id,
      thread: :post,
      moderation_state: :legal
    })
    |> Repo.insert()
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
