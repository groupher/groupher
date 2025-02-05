defmodule GroupherServer.Test.CMS.Articles.Doc do
  use GroupherServer.TestTools

  import Helper.Utils, only: [get_config: 2]

  alias Helper.ORM
  alias GroupherServer.{CMS, Repo}
  alias Helper.Converter.{EditorToHTML, HtmlSanitizer}

  alias EditorToHTML.{Class, Validator}
  alias CMS.Model.{Author, ArticleDocument, Community, Doc, DocDocument}

  @root_class Class.article()
  @last_year Timex.shift(Timex.beginning_of_year(Timex.now()), days: -3, seconds: -1)
  @article_digest_length get_config(:article, :digest_length)

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)

    {:ok, community} = db_insert(:community)
    {:ok, doc} = db_insert(:doc)

    doc_attrs = mock_attrs(:doc, %{community_id: community.id})

    {:ok, ~m(user user2 community doc doc_attrs)a}
  end

  describe "[cms doc curd]" do
    test "created doc should have auto_increase inner_id", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      assert doc.inner_id == 1

      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      assert doc.inner_id == 2

      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      assert doc.inner_id == 3

      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      assert blog.inner_id == 1

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      assert blog.inner_id == 2

      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      assert changelog.inner_id == 1

      {:ok, community} = ORM.find(Community, community.id)

      assert community.meta.docs_inner_id_index == 3
      assert community.meta.blogs_inner_id_index == 2
      assert community.meta.changelogs_inner_id_index == 1
      assert community.meta.posts_inner_id_index == 0

      assert community.articles_count == 6
    end

    test "can create doc with valid attrs", ~m(user community doc_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user.id)

      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      doc = Repo.preload(doc, :document)

      body_map = Jason.decode!(doc.document.body)

      assert doc.meta.thread == "DOC"

      assert doc.title == doc_attrs.title
      assert body_map |> Validator.is_valid()

      assert doc.document.body_html
             |> String.contains?(~s(<div class="#{@root_class["viewer"]}">))

      assert doc.document.body_html |> String.contains?(~s(<p id="block-))

      paragraph_text = body_map["blocks"] |> List.first() |> get_in(["data", "text"])

      assert doc.digest ==
               paragraph_text
               |> HtmlSanitizer.strip_all_tags()
               |> String.slice(0, @article_digest_length)
    end

    test "created doc should have original_community info", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      assert doc.original_community_slug == community.slug
      assert doc.original_community_id == community.id
    end

    test "created doc should have a acitve_at field, same with inserted_at",
         ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      assert doc.active_at == doc.inserted_at
    end

    test "should read doc by original community and inner id",
         ~m(doc_attrs community user)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      {:ok, doc2} = CMS.read_article(doc.original_community_slug, :doc, doc.inner_id)

      assert doc.id == doc2.id
    end

    test "should read doc by original community and inner id with user",
         ~m(doc_attrs community user)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      {:ok, doc2} = CMS.read_article(doc.original_community_slug, :doc, doc.inner_id, user)

      assert doc.id == doc2.id

      {:ok, created} = ORM.find(Doc, doc2.id)
      assert user.id in created.meta.viewed_user_ids
    end

    test "read doc should update views and meta viewed_user_list",
         ~m(doc_attrs community user user2)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      # same user duplicate case
      {:ok, _} = CMS.read_article(doc.original_community_slug, :doc, doc.inner_id, user)
      {:ok, created} = ORM.find(Doc, doc.id)

      assert created.meta.viewed_user_ids |> length == 1
      assert user.id in created.meta.viewed_user_ids

      {:ok, _} = CMS.read_article(doc.original_community_slug, :doc, doc.inner_id, user2)
      {:ok, created} = ORM.find(Doc, doc.id)

      assert created.meta.viewed_user_ids |> length == 2
      assert user.id in created.meta.viewed_user_ids
      assert user2.id in created.meta.viewed_user_ids
    end

    test "read doc should contains viewer_has_xxx state",
         ~m(doc_attrs community user user2)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, doc} = CMS.read_article(doc.original_community_slug, :doc, doc.inner_id, user)

      assert not doc.viewer_has_collected
      assert not doc.viewer_has_upvoted
      assert not doc.viewer_has_reported

      {:ok, doc} = CMS.read_article(doc.original_community_slug, :doc, doc.inner_id)

      assert not doc.viewer_has_collected
      assert not doc.viewer_has_upvoted
      assert not doc.viewer_has_reported

      {:ok, doc} = CMS.read_article(doc.original_community_slug, :doc, doc.inner_id, user2)

      assert not doc.viewer_has_collected
      assert not doc.viewer_has_upvoted
      assert not doc.viewer_has_reported

      {:ok, _} = CMS.upvote_article(:doc, doc.id, user)
      {:ok, _} = CMS.collect_article(:doc, doc.id, user)
      {:ok, _} = CMS.report_article(:doc, doc.id, "reason", "attr_info", user)

      {:ok, doc} = CMS.read_article(doc.original_community_slug, :doc, doc.inner_id, user)

      assert doc.viewer_has_collected
      assert doc.viewer_has_upvoted
      assert doc.viewer_has_reported
    end

    test "add user to cms authors, if the user is not exsit in cms authors",
         ~m(user community doc_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user.id)

      {:ok, _} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, author} = ORM.find_by(Author, user_id: user.id)
      assert author.user_id == user.id
    end

    test "create doc with an non-exsit community fails", ~m(user)a do
      invalid_attrs = mock_attrs(:doc, %{community_id: non_exsit_id()})
      ivalid_community = %Community{id: non_exsit_id(), slug: non_exsit_slug()}

      assert {:error, _} = CMS.create_article(ivalid_community, :doc, invalid_attrs, user)
    end
  end

  describe "[cms doc sink/undo_sink]" do
    test "if a doc is too old, read doc should update can_undo_sink flag",
         ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      assert doc.meta.can_undo_sink

      {:ok, doc_last_year} =
        db_insert(:doc, %{
          title: "last year",
          inserted_at: @last_year,
          inner_id: doc.inner_id + 1,
          original_community_slug: doc.original_community_slug
        })

      {:ok, doc_last_year} =
        CMS.read_article(doc_last_year.original_community_slug, :doc, doc_last_year.inner_id)

      assert not doc_last_year.meta.can_undo_sink

      {:ok, doc_last_year} =
        CMS.read_article(
          doc_last_year.original_community_slug,
          :doc,
          doc_last_year.inner_id,
          user
        )

      assert not doc_last_year.meta.can_undo_sink
    end

    test "can sink a doc", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      assert not doc.meta.is_sinked

      {:ok, doc} = CMS.sink_article(:doc, doc.id)
      assert doc.meta.is_sinked
      assert doc.active_at == doc.inserted_at
    end

    test "can undo sink doc", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, doc} = CMS.sink_article(:doc, doc.id)
      assert doc.meta.is_sinked
      assert doc.meta.last_active_at == doc.active_at

      {:ok, doc} = CMS.undo_sink_article(:doc, doc.id)
      assert not doc.meta.is_sinked
      assert doc.active_at == doc.meta.last_active_at
    end

    test "can not undo sink to old doc", ~m()a do
      {:ok, doc_last_year} = db_insert(:doc, %{title: "last year", inserted_at: @last_year})

      {:error, reason} = CMS.undo_sink_article(:doc, doc_last_year.id)
      is_error?(reason, :undo_sink_old_article)
    end
  end

  describe "[cms doc batch delete]" do
    test "can batch delete docs with inner_ids", ~m(user community doc_attrs)a do
      {:ok, doc1} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, doc2} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, doc3} = CMS.create_article(community, :doc, doc_attrs, user)

      CMS.batch_mark_delete_articles(community.slug, :doc, [
        doc1.inner_id,
        doc2.inner_id
      ])

      {:ok, doc1} = ORM.find(Doc, doc1.id)
      {:ok, doc2} = ORM.find(Doc, doc2.id)
      {:ok, doc3} = ORM.find(Doc, doc3.id)

      assert doc1.mark_delete == true
      assert doc2.mark_delete == true
      assert doc3.mark_delete == false
    end

    test "can undo batch delete docs with inner_ids", ~m(user community doc_attrs)a do
      {:ok, doc1} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, doc2} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, doc3} = CMS.create_article(community, :doc, doc_attrs, user)

      CMS.batch_mark_delete_articles(community.slug, :doc, [
        doc1.inner_id,
        doc2.inner_id
      ])

      CMS.batch_undo_mark_delete_articles(community.slug, :doc, [
        doc1.inner_id,
        doc2.inner_id
      ])

      {:ok, doc1} = ORM.find(Doc, doc1.id)
      {:ok, doc2} = ORM.find(Doc, doc2.id)
      {:ok, doc3} = ORM.find(Doc, doc3.id)

      assert doc1.mark_delete == false
      assert doc2.mark_delete == false
    end
  end

  describe "[cms doc document]" do
    test "will create related document after create", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, doc} = CMS.read_article(doc.original_community_slug, :doc, doc.inner_id)
      assert not is_nil(doc.document.body_html)
      {:ok, doc} = CMS.read_article(doc.original_community_slug, :doc, doc.inner_id, user)
      assert not is_nil(doc.document.body_html)

      {:ok, article_doc} = ORM.find_by(ArticleDocument, %{article_id: doc.id, thread: "DOC"})

      {:ok, doc_doc} = ORM.find_by(DocDocument, %{doc_id: doc.id})

      assert doc.document.body == doc_doc.body
      assert article_doc.body == doc_doc.body
    end

    test "delete doc should also delete related document",
         ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      {:ok, _article_doc} = ORM.find_by(ArticleDocument, %{article_id: doc.id, thread: "DOC"})

      {:ok, _doc} = ORM.find_by(DocDocument, %{doc_id: doc.id})

      {:ok, _} = CMS.delete_article(doc)

      {:error, _} = ORM.find(Doc, doc.id)
      {:error, _} = ORM.find_by(ArticleDocument, %{article_id: doc.id, thread: "DOC"})
      {:error, _} = ORM.find_by(DocDocument, %{doc_id: doc.id})
    end

    test "update doc should also update related document",
         ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      body = mock_rich_text(~s(new content))
      {:ok, doc} = CMS.update_article(doc, %{body: body})

      {:ok, article_doc} = ORM.find_by(ArticleDocument, %{article_id: doc.id, thread: "DOC"})

      {:ok, doc_doc} = ORM.find_by(DocDocument, %{doc_id: doc.id})

      assert String.contains?(doc_doc.body, "new content")
      assert String.contains?(article_doc.body, "new content")
    end
  end
end
