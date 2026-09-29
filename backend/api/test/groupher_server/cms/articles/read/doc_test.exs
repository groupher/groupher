defmodule GroupherServer.Test.CMS.Articles.Doc do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Articles.Publish
  alias CMS.Articles.Trash
  alias CMS.Docs.Branch
  alias CMS.FrontDesk
  alias CMS.Model.{ArticleDocument, ArticleEmotionCount, ArticleStats, Doc}

  @article_digest_length CMS.Artiment.Config.digest_length()

  setup do
    {community, _, doc_attrs, user} = mock_article(:doc)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 community doc_attrs)a}
  end

  describe "[cms doc curd]" do
    test "created doc should have auto_increase inner_id", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      assert doc.inner_id == 2

      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      assert doc.inner_id == 3

      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      assert doc.inner_id == 4

      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      assert blog.inner_id == 1

      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      assert blog.inner_id == 2

      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      assert changelog.inner_id == 1

      {:ok, community} = FrontDesk.community(community.slug)

      assert community.meta.docs_inner_id_index == 4
      assert community.meta.blogs_inner_id_index == 2
      assert community.meta.changelogs_inner_id_index == 1
      assert community.meta.posts_inner_id_index == 0

      assert community.articles_count == 7
    end

    test "can create doc with valid attrs", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      doc = Repo.preload(doc, :document)

      body_map = Jason.decode!(doc.document.json)

      assert doc.meta.thread == :doc

      assert doc.title == doc_attrs.title
      assert is_list(body_map)

      assert doc.document.html |> String.contains?("<p")

      assert is_binary(doc.digest)
      assert String.length(doc.digest) <= @article_digest_length
    end

    test "created doc should have original_community info", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      assert doc.community_id == community.id
      assert doc.community_id == community.id
    end

    test "created doc should have a active_at field, same with inserted_at",
         ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      assert doc.active_at == doc.inserted_at
    end

    test "should read doc by original community and inner id",
         ~m(doc_attrs community user)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      {:ok, doc2} =
        CMS.Articles.read(article_community(doc), :doc, doc.inner_id)

      assert doc.id == doc2.id
    end

    test "should read doc by original community and inner id with user",
         ~m(doc_attrs community user)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      {:ok, doc2} =
        CMS.Articles.read(article_community(doc), :doc, doc.inner_id, user)

      assert doc.id == doc2.id
      refute CMS.ViewTracker.viewer_state(doc2, user).viewer_has_viewed

      assert {:ok, %{tracked: true}} =
               track_article_view(doc2, user, read_purpose: :public_read)

      assert CMS.ViewTracker.viewer_state(doc2, user).viewer_has_viewed
    end

    test "track projection updates views and meta viewed_user_list",
         ~m(doc_attrs community user user2)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      # same user duplicate case
      {:ok, %{tracked: true}} =
        track_article_view(doc, user, read_purpose: :public_read)

      {:ok, %{tracked: true}} =
        track_article_view(doc, user, read_purpose: :public_read)

      assert CMS.ViewTracker.viewer_state(doc, user).viewer_has_viewed

      {:ok, %{tracked: true}} =
        track_article_view(doc, user2, read_purpose: :public_read)

      {:ok, created} = ORM.find(Doc, doc.id)
      assert {:ok, %{views: 2}} = CMS.ArticleStats.fetch(:doc, created.id)
      assert CMS.ViewTracker.viewer_state(doc, user).viewer_has_viewed
      assert CMS.ViewTracker.viewer_state(doc, user2).viewer_has_viewed
    end

    test "public doc read does not hydrate viewer-private state",
         ~m(doc_attrs community user user2)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      {:ok, doc} =
        CMS.Articles.read(
          article_community(doc),
          :doc,
          doc.inner_id,
          user
        )

      assert not doc.viewer_has_collected
      assert not doc.viewer_has_upvoted
      assert not doc.viewer_has_reported

      {:ok, doc} =
        CMS.Articles.read(article_community(doc), :doc, doc.inner_id)

      assert not doc.viewer_has_collected
      assert not doc.viewer_has_upvoted
      assert not doc.viewer_has_reported

      {:ok, doc} =
        CMS.Articles.read(
          article_community(doc),
          :doc,
          doc.inner_id,
          user2
        )

      assert not doc.viewer_has_collected
      assert not doc.viewer_has_upvoted
      assert not doc.viewer_has_reported

      {:ok, _} = CMS.Interactions.upvote(doc, user)
      {:ok, doc} = ORM.find(Doc, doc.id)
      {:ok, _} = CMS.Interactions.collect(doc, user)
      {:ok, _} = CMS.AbuseReports.article(doc, "reason", "attr_info", user)

      {:ok, doc} =
        CMS.Articles.read(
          article_community(doc),
          :doc,
          doc.inner_id,
          user
        )

      refute doc.viewer_has_collected
      refute doc.viewer_has_upvoted
      refute doc.viewer_has_reported

      assert %{viewer_has_collected: true, viewer_has_upvoted: true} =
               CMS.Interactions.viewer_state(doc, user)
    end

    test "add user to cms authors, if the user is not exist in cms authors",
         ~m(user2 community doc_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user2.id)

      {:ok, _} = CMS.Articles.create(community, :doc, doc_attrs, user2)
      {:ok, author} = ORM.find_by(Author, user_id: user2.id)
      assert author.user_id == user2.id
    end
  end

  describe "[cms doc sink/undo_sink]" do
    test "if a doc is too old, read doc should update can_undo_sink flag",
         ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      assert doc.meta.can_undo_sink

      {:ok, doc_last_year} =
        db_insert(:doc, %{
          title: "last year",
          inserted_at: @last_year,
          inner_id: doc.inner_id + 1,
          community_id: doc.community_id
        })

      {:ok, doc_last_year} =
        CMS.Articles.read(
          article_community(doc_last_year),
          :doc,
          doc_last_year.inner_id
        )

      assert not doc_last_year.meta.can_undo_sink

      {:ok, doc_last_year} =
        CMS.Articles.read(
          article_community(doc_last_year),
          :doc,
          doc_last_year.inner_id,
          user
        )

      assert not doc_last_year.meta.can_undo_sink
    end

    test "can sink a doc", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      assert not doc.meta.is_sunk

      {:ok, doc} = CMS.Articles.sink(doc)
      assert doc.meta.is_sunk
      assert doc.active_at == doc.inserted_at
    end

    test "can undo sink doc", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      {:ok, doc} = CMS.Articles.sink(doc)
      assert doc.meta.is_sunk
      assert doc.meta.last_active_at == doc.active_at

      {:ok, doc} = CMS.Articles.undo_sink(doc)
      assert not doc.meta.is_sunk
      assert doc.active_at == doc.meta.last_active_at
    end

    test "can not undo sink to old doc", ~m()a do
      {:ok, doc_last_year} = db_insert(:doc, %{title: "last year", inserted_at: @last_year})

      {:error, reason} = CMS.Articles.undo_sink(doc_last_year)
      is_error?(reason, {{:cms, :article}, :undo_sink_old_article})
    end
  end

  describe "[cms doc document]" do
    test "will create related document after create", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      {:ok, doc} =
        CMS.Articles.read(article_community(doc), :doc, doc.inner_id)

      assert not is_nil(doc.document.html)

      {:ok, doc} =
        CMS.Articles.read(
          article_community(doc),
          :doc,
          doc.inner_id,
          user
        )

      assert not is_nil(doc.document.html)

      {:ok, article_doc} = ORM.find_by(ArticleDocument, %{article_id: doc.id, thread: :doc})

      assert doc.document.json == article_doc.json
    end

    test "delete doc should also delete related document",
         ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      assert {:ok, _} = CMS.Interactions.emotion(doc, :heart, user)

      {:ok, _} = ORM.find_by(ArticleDocument, %{article_id: doc.id, thread: :doc})
      assert Repo.get_by(ArticleStats, thread: :doc, article_id: doc.id)

      assert Repo.get_by(ArticleEmotionCount,
               thread: :doc,
               article_id: doc.id,
               type: :heart
             )

      {:ok, action} =
        Trash.create_action(community, user, %{
          root_type: "doc_tree_page",
          root_ref: "document-delete-test"
        })

      {:ok, trash_item} =
        Trash.attach(action, community, :doc, doc.article_hash_id, user)

      {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(trash_item, user)

      {:error, _} = ORM.find(Doc, doc.id)
      {:error, _} = ORM.find_by(ArticleDocument, %{article_id: doc.id, thread: :doc})
      refute Repo.get_by(ArticleStats, thread: :doc, article_id: doc.id)
      refute Repo.get_by(ArticleEmotionCount, thread: :doc, article_id: doc.id, type: :heart)
    end

    test "permanent delete keeps the same logical Doc in another branch",
         ~m(user community doc_attrs)a do
      {:ok, main_doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      {:ok, preview_branch} =
        Branch.create_preview(community, %{slug: "delete-isolation"}, user)

      preview_attrs =
        doc_attrs
        |> Map.put(:article_hash_id, main_doc.article_hash_id)
        |> Map.put(:branch_id, preview_branch.id)
        |> Map.put(:title, "Preview branch document")

      {:ok, _preview_draft} =
        CMS.Articles.create_draft(community, :doc, preview_attrs, user)

      {:ok, %{article: preview_doc}} =
        Publish.publish(
          community,
          :doc,
          main_doc.article_hash_id,
          user,
          branch_id: preview_branch.id
        )

      assert main_doc.branch_id != preview_doc.branch_id
      assert main_doc.article_hash_id == preview_doc.article_hash_id

      assert {:ok, _} = CMS.Interactions.emotion(main_doc, :heart, user)
      assert :ok = CMS.ArticleStats.initialize(preview_doc)

      %ArticleEmotionCount{}
      |> ArticleEmotionCount.changeset(%{
        thread: :doc,
        article_id: preview_doc.id,
        type: :beer,
        count: 1,
        interaction_revision: 1
      })
      |> Repo.insert!()

      assert Repo.get_by(ArticleStats, thread: :doc, article_id: preview_doc.id)

      assert Repo.get_by(ArticleEmotionCount,
               thread: :doc,
               article_id: preview_doc.id,
               type: :beer
             )

      {:ok, action} =
        Trash.create_action(community, user, %{
          root_type: "doc_tree_page",
          root_ref: "branch-delete-isolation"
        })

      {:ok, trash_item} =
        Trash.attach(action, community, :doc, main_doc.article_hash_id, user,
          branch_id: main_doc.branch_id
        )

      assert {:ok, %{done: true}} =
               CMS.Articles.permanently_delete_trashed(trash_item, user)

      refute Repo.get(Doc, main_doc.id)
      refute Repo.get_by(ArticleStats, thread: :doc, article_id: main_doc.id)

      assert Repo.get(Doc, preview_doc.id)
      assert Repo.get_by(ArticleStats, thread: :doc, article_id: preview_doc.id)

      assert Repo.get_by(ArticleEmotionCount,
               thread: :doc,
               article_id: preview_doc.id,
               type: :beer
             )
    end

    test "update doc should also update related document",
         ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      body = mock_rich_text(~s(new content))

      {:ok, doc} =
        CMS.Articles.update(doc, %{body_bag: mock_body_bag(body), expected_version: doc.version})

      {:ok, article_doc} = ORM.find_by(ArticleDocument, %{article_id: doc.id, thread: :doc})

      assert String.contains?(article_doc.json, "new content")
    end
  end
end
