defmodule GroupherServer.Test.CMS.Articles.Blog do
  use GroupherServer.TestTools

  import Helper.Utils, only: [get_config: 2]

  alias Helper.ORM
  alias GroupherServer.{CMS, Repo}
  alias Helper.Converter.{EditorToHTML, HtmlSanitizer}

  alias EditorToHTML.{Class, Validator}
  alias CMS.Model.{Author, ArticleDocument, Community, Blog, BlogDocument}

  @root_class Class.article()
  @last_year Timex.shift(Timex.beginning_of_year(Timex.now()), days: -3, seconds: -1)
  @article_digest_length get_config(:article, :digest_length)

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)

    {:ok, community} = db_insert(:community)
    {:ok, blog} = db_insert(:blog)

    blog_attrs = mock_attrs(:blog, %{community_id: community.id})

    {:ok, ~m(user user2 community blog blog_attrs)a}
  end

  describe "[cms blog curd]" do
    test "created blog should have auto_increase inner_id", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      assert blog.inner_id == 1

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      assert blog.inner_id == 2

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      assert blog.inner_id == 3

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)
      assert post.inner_id == 1

      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)
      assert post.inner_id == 2

      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      assert changelog.inner_id == 1

      {:ok, community} = ORM.find(Community, community.id)

      assert community.meta.blogs_inner_id_index == 3
      assert community.meta.posts_inner_id_index == 2
      assert community.meta.changelogs_inner_id_index == 1
      assert community.meta.docs_inner_id_index == 0

      assert community.articles_count == 6
    end

    test "can create blog with valid attrs", ~m(user community blog_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user.id)

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      blog = Repo.preload(blog, :document)

      body_map = Jason.decode!(blog.document.body)

      assert blog.meta.thread == "BLOG"

      assert blog.title == blog_attrs.title
      assert body_map |> Validator.is_valid()

      assert blog.document.body_html
             |> String.contains?(~s(<div class="#{@root_class["viewer"]}">))

      assert blog.document.body_html |> String.contains?(~s(<p id="block-))

      paragraph_text = body_map["blocks"] |> List.first() |> get_in(["data", "text"])

      assert blog.digest ==
               paragraph_text
               |> HtmlSanitizer.strip_all_tags()
               |> String.slice(0, @article_digest_length)
    end

    test "created blog should have original_community info",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      assert blog.original_community_slug == community.slug
      assert blog.original_community_id == community.id
    end

    test "created blog should have a acitve_at field, same with inserted_at",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      assert blog.active_at == blog.inserted_at
    end

    test "should read blog by original community and inner id",
         ~m(blog_attrs community user)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      {:ok, blog2} = CMS.read_article(blog.original_community_slug, :blog, blog.inner_id)

      assert blog.id == blog2.id
    end

    test "should read blog by original community and inner id with user",
         ~m(blog_attrs community user)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      {:ok, blog2} = CMS.read_article(blog.original_community_slug, :blog, blog.inner_id, user)

      assert blog.id == blog2.id

      {:ok, created} = ORM.find(Blog, blog2.id)
      assert user.id in created.meta.viewed_user_ids
    end

    test "read blog should update views and meta viewed_user_list",
         ~m(blog_attrs community user user2)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      # same user duplicate case
      {:ok, _} = CMS.read_article(blog.original_community_slug, :blog, blog.inner_id, user)
      {:ok, created} = ORM.find(Blog, blog.id)

      assert created.meta.viewed_user_ids |> length == 1
      assert user.id in created.meta.viewed_user_ids

      {:ok, _} = CMS.read_article(blog.original_community_slug, :blog, blog.inner_id, user2)
      {:ok, created} = ORM.find(Blog, blog.id)

      assert created.meta.viewed_user_ids |> length == 2
      assert user.id in created.meta.viewed_user_ids
      assert user2.id in created.meta.viewed_user_ids
    end

    test "read blog should contains viewer_has_xxx state",
         ~m(blog_attrs community user user2)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, blog} = CMS.read_article(blog.original_community_slug, :blog, blog.inner_id, user)

      assert not blog.viewer_has_collected
      assert not blog.viewer_has_upvoted
      assert not blog.viewer_has_reported

      {:ok, blog} = CMS.read_article(blog.original_community_slug, :blog, blog.inner_id)

      assert not blog.viewer_has_collected
      assert not blog.viewer_has_upvoted
      assert not blog.viewer_has_reported

      {:ok, blog} = CMS.read_article(blog.original_community_slug, :blog, blog.inner_id, user2)

      assert not blog.viewer_has_collected
      assert not blog.viewer_has_upvoted
      assert not blog.viewer_has_reported

      {:ok, _} = CMS.upvote_article(:blog, blog.id, user)
      {:ok, _} = CMS.collect_article(:blog, blog.id, user)
      {:ok, _} = CMS.report_article(:blog, blog.id, "reason", "attr_info", user)

      {:ok, blog} = CMS.read_article(blog.original_community_slug, :blog, blog.inner_id, user)

      assert blog.viewer_has_collected
      assert blog.viewer_has_upvoted
      assert blog.viewer_has_reported
    end

    test "add user to cms authors, if the user is not exsit in cms authors",
         ~m(user community blog_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user.id)

      {:ok, _} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, author} = ORM.find_by(Author, user_id: user.id)
      assert author.user_id == user.id
    end

    test "create blog with an non-exsit community fails", ~m(user)a do
      invalid_attrs = mock_attrs(:blog, %{community_id: non_exsit_id()})
      ivalid_community = %Community{id: non_exsit_id(), slug: non_exsit_slug()}

      assert {:error, _} = CMS.create_article(ivalid_community, :blog, invalid_attrs, user)
    end
  end

  describe "[cms blog sink/undo_sink]" do
    test "if a blog is too old, read blog should update can_undo_sink flag",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      assert blog.meta.can_undo_sink

      {:ok, doc_last_year} =
        db_insert(:blog, %{
          title: "last year",
          inserted_at: @last_year,
          inner_id: blog.inner_id + 1,
          original_community_slug: blog.original_community_slug
        })

      {:ok, doc_last_year} =
        CMS.read_article(doc_last_year.original_community_slug, :blog, doc_last_year.inner_id)

      assert not doc_last_year.meta.can_undo_sink

      {:ok, doc_last_year} =
        CMS.read_article(
          doc_last_year.original_community_slug,
          :blog,
          doc_last_year.inner_id,
          user
        )

      assert not doc_last_year.meta.can_undo_sink
    end

    test "can sink a blog", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      assert not blog.meta.is_sinked

      {:ok, blog} = CMS.sink_article(:blog, blog.id)
      assert blog.meta.is_sinked
      assert blog.active_at == blog.inserted_at
    end

    test "can undo sink blog", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, blog} = CMS.sink_article(:blog, blog.id)
      assert blog.meta.is_sinked
      assert blog.meta.last_active_at == blog.active_at

      {:ok, blog} = CMS.undo_sink_article(:blog, blog.id)
      assert not blog.meta.is_sinked
      assert blog.active_at == blog.meta.last_active_at
    end

    test "can not undo sink to old blog", ~m()a do
      {:ok, doc_last_year} = db_insert(:blog, %{title: "last year", inserted_at: @last_year})

      {:error, reason} = CMS.undo_sink_article(:blog, doc_last_year.id)
      is_error?(reason, :undo_sink_old_article)
    end
  end

  describe "[cms blog batch delete]" do
    test "can batch delete blogs with inner_ids", ~m(user community blog_attrs)a do
      {:ok, blog1} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, blog2} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, blog3} = CMS.create_article(community, :blog, blog_attrs, user)

      CMS.batch_mark_delete_articles(community.slug, :blog, [
        blog1.inner_id,
        blog2.inner_id
      ])

      {:ok, blog1} = ORM.find(Blog, blog1.id)
      {:ok, blog2} = ORM.find(Blog, blog2.id)
      {:ok, blog3} = ORM.find(Blog, blog3.id)

      assert blog1.mark_delete == true
      assert blog2.mark_delete == true
      assert blog3.mark_delete == false
    end

    test "can undo batch delete blogs with inner_ids", ~m(user community blog_attrs)a do
      {:ok, blog1} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, blog2} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, blog3} = CMS.create_article(community, :blog, blog_attrs, user)

      CMS.batch_mark_delete_articles(community.slug, :blog, [
        blog1.inner_id,
        blog2.inner_id
      ])

      CMS.batch_undo_mark_delete_articles(community.slug, :blog, [
        blog1.inner_id,
        blog2.inner_id
      ])

      {:ok, blog1} = ORM.find(Blog, blog1.id)
      {:ok, blog2} = ORM.find(Blog, blog2.id)
      {:ok, blog3} = ORM.find(Blog, blog3.id)

      assert blog1.mark_delete == false
      assert blog2.mark_delete == false
    end
  end

  describe "[cms blog document]" do
    test "will create related document after create", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, blog} = CMS.read_article(blog.original_community_slug, :blog, blog.inner_id)
      assert not is_nil(blog.document.body_html)
      {:ok, blog} = CMS.read_article(blog.original_community_slug, :blog, blog.inner_id, user)
      assert not is_nil(blog.document.body_html)

      {:ok, article_doc} = ORM.find_by(ArticleDocument, %{article_id: blog.id, thread: "BLOG"})

      {:ok, doc_doc} = ORM.find_by(BlogDocument, %{blog_id: blog.id})

      assert blog.document.body == doc_doc.body
      assert article_doc.body == doc_doc.body
    end

    test "delete blog should also delete related document",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      {:ok, _article_doc} = ORM.find_by(ArticleDocument, %{article_id: blog.id, thread: "BLOG"})

      {:ok, _doc} = ORM.find_by(BlogDocument, %{blog_id: blog.id})

      {:ok, _} = CMS.delete_article(blog)

      {:error, _} = ORM.find(Blog, blog.id)
      {:error, _} = ORM.find_by(ArticleDocument, %{article_id: blog.id, thread: "BLOG"})
      {:error, _} = ORM.find_by(BlogDocument, %{blog_id: blog.id})
    end

    test "update blog should also update related document",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      body = mock_rich_text(~s(new content))
      {:ok, blog} = CMS.update_article(blog, %{body: body})

      {:ok, article_doc} = ORM.find_by(ArticleDocument, %{article_id: blog.id, thread: "BLOG"})

      {:ok, doc_doc} = ORM.find_by(BlogDocument, %{blog_id: blog.id})

      assert String.contains?(doc_doc.body, "new content")
      assert String.contains?(article_doc.body, "new content")
    end
  end
end
