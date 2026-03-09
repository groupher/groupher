defmodule GroupherServer.Test.CMS.Articles.Blog do
  @moduledoc false

  use GroupherServer.TestTools

  alias CMS.Model.{ArticleDocument, BlogDocument}
  @article_digest_length get_config(:article, :digest_length)

  setup do
    {community, _, blog_attrs, user} = mock_article(:blog)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 community blog_attrs)a}
  end

  describe "[cms blog curd]" do
    test "created blog should have auto_increase inner_id", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      assert blog.inner_id == 2

      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      assert blog.inner_id == 3

      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      assert blog.inner_id == 4

      post_attrs = mock_attrs(:post, %{community_id: community.id})
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      assert post.inner_id == 1

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      assert post.inner_id == 2

      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      assert changelog.inner_id == 1

      {:ok, community} = ORM.find(Community, community.id)

      assert community.meta.blogs_inner_id_index == 4
      assert community.meta.posts_inner_id_index == 2
      assert community.meta.changelogs_inner_id_index == 1
      assert community.meta.docs_inner_id_index == 0

      assert community.articles_count == 7
    end

    test "can create blog with valid attrs", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      blog = Repo.preload(blog, :document)

      body_map = Jason.decode!(blog.document.json)

      assert blog.meta.thread == "BLOG"

      assert blog.title == blog_attrs.title
      assert is_list(body_map)

      assert blog.document.html |> String.contains?(~s(<p>))

      assert is_binary(blog.digest)
      assert String.length(blog.digest) <= @article_digest_length
    end

    test "created blog should have original_community info",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      assert blog.community_slug == community.slug
      assert blog.community_id == community.id
    end

    test "created blog should have a active_at field, same with inserted_at",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      assert blog.active_at == blog.inserted_at
    end

    test "should read blog by original community and inner id",
         ~m(blog_attrs community user)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      {:ok, blog2} = CMS.Articles.read(blog.community_slug, :blog, blog.inner_id)

      assert blog.id == blog2.id
    end

    test "should read blog by original community and inner id with user",
         ~m(blog_attrs community user)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      {:ok, blog2} = CMS.Articles.read(blog.community_slug, :blog, blog.inner_id, user)

      assert blog.id == blog2.id

      {:ok, created} = ORM.find(Blog, blog2.id)
      assert user.id in created.meta.viewed_user_ids
    end

    test "read blog should update views and meta viewed_user_list",
         ~m(blog_attrs community user user2)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      # same user duplicate case
      {:ok, _} = CMS.Articles.read(blog.community_slug, :blog, blog.inner_id, user)
      {:ok, created} = ORM.find(Blog, blog.id)

      assert created.meta.viewed_user_ids |> length == 1
      assert user.id in created.meta.viewed_user_ids

      {:ok, _} = CMS.Articles.read(blog.community_slug, :blog, blog.inner_id, user2)
      {:ok, created} = ORM.find(Blog, blog.id)

      assert created.meta.viewed_user_ids |> length == 2
      assert user.id in created.meta.viewed_user_ids
      assert user2.id in created.meta.viewed_user_ids
    end

    test "read blog should contains viewer_has_xxx state", ~m(blog_attrs community user user2)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      {:ok, blog} = CMS.Articles.read(blog.community_slug, :blog, blog.inner_id, user)

      assert not blog.viewer_has_collected
      assert not blog.viewer_has_upvoted
      assert not blog.viewer_has_reported

      {:ok, blog} = CMS.Articles.read(blog.community_slug, :blog, blog.inner_id)

      assert not blog.viewer_has_collected
      assert not blog.viewer_has_upvoted
      assert not blog.viewer_has_reported

      {:ok, blog} = CMS.Articles.read(blog.community_slug, :blog, blog.inner_id, user2)

      assert not blog.viewer_has_collected
      assert not blog.viewer_has_upvoted
      assert not blog.viewer_has_reported

      {:ok, _} = CMS.Articles.upvote(blog, user)
      {:ok, blog} = ORM.find(Blog, blog.id)
      {:ok, _} = CMS.Articles.collect(blog, user)
      {:ok, _} = CMS.AbuseReports.article(blog, "reason", "attr_info", user)

      {:ok, blog} = CMS.Articles.read(blog.community_slug, :blog, blog.inner_id, user)

      assert blog.viewer_has_collected
      assert blog.viewer_has_upvoted
      assert blog.viewer_has_reported
    end

    test "add user to cms authors, if the user is not exist in cms authors",
         ~m(user2 community blog_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user2.id)

      {:ok, _} = CMS.Articles.create(community, :blog, blog_attrs, user2)
      {:ok, author} = ORM.find_by(Author, user_id: user2.id)
      assert author.user_id == user2.id
    end
  end

  describe "[cms blog sink/undo_sink]" do
    test "if a blog is too old, read blog should update can_undo_sink flag",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      assert blog.meta.can_undo_sink

      {:ok, doc_last_year} =
        db_insert(:blog, %{
          title: "last year",
          inserted_at: @last_year,
          inner_id: blog.inner_id + 1,
          community_slug: blog.community_slug
        })

      {:ok, doc_last_year} =
        CMS.Articles.read(doc_last_year.community_slug, :blog, doc_last_year.inner_id)

      assert not doc_last_year.meta.can_undo_sink

      {:ok, doc_last_year} =
        CMS.Articles.read(
          doc_last_year.community_slug,
          :blog,
          doc_last_year.inner_id,
          user
        )

      assert not doc_last_year.meta.can_undo_sink
    end

    test "can sink a blog", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      assert not blog.meta.is_sunk

      {:ok, blog} = CMS.Articles.sink(blog)
      assert blog.meta.is_sunk
      assert blog.active_at == blog.inserted_at
    end

    test "can undo sink blog", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      {:ok, blog} = CMS.Articles.sink(blog)
      assert blog.meta.is_sunk
      assert blog.meta.last_active_at == blog.active_at

      {:ok, blog} = CMS.Articles.undo_sink(blog)
      assert not blog.meta.is_sunk
      assert blog.active_at == blog.meta.last_active_at
    end

    test "can not undo sink to old blog", ~m()a do
      {:ok, doc_last_year} = db_insert(:blog, %{title: "last year", inserted_at: @last_year})

      {:error, reason} = CMS.Articles.undo_sink(doc_last_year)
      is_error?(reason, :undo_sink_old_article)
    end
  end

  describe "[cms blog batch delete]" do
    test "can batch delete blogs with inner_ids", ~m(user community blog_attrs)a do
      {:ok, blog1} = CMS.Articles.create(community, :blog, blog_attrs, user)
      {:ok, blog2} = CMS.Articles.create(community, :blog, blog_attrs, user)
      {:ok, blog3} = CMS.Articles.create(community, :blog, blog_attrs, user)

      CMS.Articles.batch_mark_delete(community.slug, :blog, [
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
      {:ok, blog1} = CMS.Articles.create(community, :blog, blog_attrs, user)
      {:ok, blog2} = CMS.Articles.create(community, :blog, blog_attrs, user)
      {:ok, blog3} = CMS.Articles.create(community, :blog, blog_attrs, user)

      CMS.Articles.batch_mark_delete(community.slug, :blog, [
        blog1.inner_id,
        blog2.inner_id
      ])

      CMS.Articles.batch_undo_mark_delete(community.slug, :blog, [
        blog1.inner_id,
        blog2.inner_id
      ])

      {:ok, blog1} = ORM.find(Blog, blog1.id)
      {:ok, blog2} = ORM.find(Blog, blog2.id)
      {:ok, _blog3} = ORM.find(Blog, blog3.id)

      assert blog1.mark_delete == false
      assert blog2.mark_delete == false
    end
  end

  describe "[cms blog document]" do
    test "will create related document after create", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      {:ok, blog} = CMS.Articles.read(blog.community_slug, :blog, blog.inner_id)
      assert not is_nil(blog.document.html)
      {:ok, blog} = CMS.Articles.read(blog.community_slug, :blog, blog.inner_id, user)
      assert not is_nil(blog.document.html)

      {:ok, article_doc} = ORM.find_by(ArticleDocument, %{article_id: blog.id, thread: "BLOG"})

      {:ok, doc_doc} = ORM.find_by(BlogDocument, %{blog_id: blog.id})

      assert blog.document.json == doc_doc.json
      assert article_doc.json == doc_doc.json
    end

    test "delete blog should also delete related document",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      {:ok, _article_doc} = ORM.find_by(ArticleDocument, %{article_id: blog.id, thread: "BLOG"})

      {:ok, _doc} = ORM.find_by(BlogDocument, %{blog_id: blog.id})

      {:ok, _} = CMS.Articles.delete(blog)

      {:error, _} = ORM.find(Blog, blog.id)
      {:error, _} = ORM.find_by(ArticleDocument, %{article_id: blog.id, thread: "BLOG"})
      {:error, _} = ORM.find_by(BlogDocument, %{blog_id: blog.id})
    end

    test "update blog should also update related document",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      body = mock_rich_text(~s(new content))
      {:ok, blog} = CMS.Articles.update(blog, %{body: body})

      {:ok, article_doc} = ORM.find_by(ArticleDocument, %{article_id: blog.id, thread: "BLOG"})

      {:ok, doc_doc} = ORM.find_by(BlogDocument, %{blog_id: blog.id})

      assert String.contains?(doc_doc.json, "new content")
      assert String.contains?(article_doc.json, "new content")
    end
  end
end
