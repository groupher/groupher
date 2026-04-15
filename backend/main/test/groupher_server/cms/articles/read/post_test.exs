defmodule GroupherServer.Test.CMS.Articles.Post do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.FrontDesk
  alias CMS.Model.{ArticleDocument, PostDocument}
  # @last_year Timex.shift(Timex.beginning_of_year(Timex.now()), days: -3)
  #            |> DateTime.truncate(:second)
  @article_digest_length get_config(:article, :digest_length)

  setup do
    {community, _, post_attrs, user} = mock_article(:post)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 community post_attrs)a}
  end

  describe "[cms post curd]" do
    test "created post should have auto_increase inner_id", ~m(user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      assert post.inner_id == 2

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      assert post.inner_id == 3

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      assert post.inner_id == 4

      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      assert blog.inner_id == 1

      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      assert blog.inner_id == 2

      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      assert changelog.inner_id == 1

      {:ok, community} = FrontDesk.community(community.slug)

      assert community.meta.posts_inner_id_index == 4
      assert community.meta.blogs_inner_id_index == 2
      assert community.meta.changelogs_inner_id_index == 1
      assert community.meta.docs_inner_id_index == 0

      assert community.articles_count == 7
    end

    test "can create post with valid attrs", ~m(user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      post = Repo.preload(post, :document)

      body_map = Jason.decode!(post.document.json)

      assert post.meta.thread == :post

      assert post.title == post_attrs.title
      assert is_list(body_map)

      assert post.document.html |> String.contains?(~s(<p>))

      assert is_binary(post.digest)
      assert String.length(post.digest) <= @article_digest_length
    end

    test "created post should have original_community info", ~m(user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      assert post.community_slug == community.slug
      assert post.community_id == community.id
    end

    test "created post should have a active_at field, same with inserted_at",
         ~m(user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      assert post.active_at == post.inserted_at
    end

    test "should read post by original community and inner id",
         ~m(post_attrs community user)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, post2} = CMS.Articles.read(post.community_slug, :post, post.inner_id)

      assert post.id == post2.id
    end

    test "should read post by original community and inner id with user",
         ~m(post_attrs community user)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, post2} = CMS.Articles.read(post.community_slug, :post, post.inner_id, user)

      assert post.id == post2.id

      {:ok, created} = ORM.find(Post, post2.id)
      assert user.id in created.meta.viewed_user_ids
    end

    test "read post should update views and meta viewed_user_list",
         ~m(post_attrs community user user2)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      # same user duplicate case
      {:ok, _} = CMS.Articles.read(post.community_slug, :post, post.inner_id, user)
      {:ok, created} = ORM.find(Post, post.id)

      assert created.meta.viewed_user_ids |> length == 1
      assert user.id in created.meta.viewed_user_ids

      {:ok, _} = CMS.Articles.read(post.community_slug, :post, post.inner_id, user2)
      {:ok, created} = ORM.find(Post, post.id)

      assert created.meta.viewed_user_ids |> length == 2
      assert user.id in created.meta.viewed_user_ids
      assert user2.id in created.meta.viewed_user_ids
    end

    ## comment article_upvote:L60 if run this test
    # test "should auto subscribe article's original community after upvote.",
    #      ~m(post_attrs community user)a do
    #   {:error, _subscriber} =
    #     ORM.find_by(CommunitySubscriber, %{community_id: community.id, user_id: user.id})

    #   {:ok, post} = CMS.create_article(community, :post, post_attrs, user)
    #   {:ok, _} = CMS.upvote_article(post, user)
    #   {:error, _} = CMS.upvote_article(post, user)

    #   {:ok, subscriber} =
    #     ORM.find_by(CommunitySubscriber, %{community_id: community.id, user_id: user.id})

    #   assert subscriber.user_id === user.id
    #   assert subscriber.community_id === community.id

    #   {:ok, community} = ORM.find(Community, community.id)
    #   assert community.subscribers_count == 1
    # end

    test "read post should contains viewer_has_xxx state", ~m(post_attrs community user user2)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, post} = CMS.Articles.read(post.community_slug, :post, post.inner_id, user)

      assert not post.viewer_has_collected
      assert not post.viewer_has_upvoted
      assert not post.viewer_has_reported

      {:ok, post} = CMS.Articles.read(post.community_slug, :post, post.inner_id)

      assert not post.viewer_has_collected
      assert not post.viewer_has_upvoted
      assert not post.viewer_has_reported

      {:ok, post} = CMS.Articles.read(post.community_slug, :post, post.inner_id, user2)

      assert not post.viewer_has_collected
      assert not post.viewer_has_upvoted
      assert not post.viewer_has_reported

      {:ok, _} = CMS.Articles.upvote(post, user)
      {:ok, post} = ORM.find(Post, post.id)
      {:ok, _} = CMS.Articles.collect(post, user)
      {:ok, _} = CMS.AbuseReports.article(post, "reason", "attr_info", user)

      {:ok, post} = CMS.Articles.read(post.community_slug, :post, post.inner_id, user)

      assert post.viewer_has_collected
      assert post.viewer_has_upvoted
      assert post.viewer_has_reported
    end

    test "add user to cms authors, if the user is not exist in cms authors",
         ~m(user2 community post_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user2.id)

      {:ok, _} = CMS.Articles.create(community, :post, post_attrs, user2)
      {:ok, author} = ORM.find_by(Author, user_id: user2.id)
      assert author.user_id == user2.id
    end
  end

  describe "[cms post sink/undo_sink]" do
    test "if a post is too old, read post should update can_undo_sink flag",
         ~m(user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      assert post.meta.can_undo_sink

      {:ok, post_last_year} =
        db_insert(:post, %{
          title: "last year",
          inserted_at: @last_year,
          inner_id: post.inner_id + 1,
          community_slug: post.community_slug
        })

      {:ok, post_last_year} =
        CMS.Articles.read(post_last_year.community_slug, :post, post_last_year.inner_id)

      assert not post_last_year.meta.can_undo_sink

      {:ok, post_last_year} =
        CMS.Articles.read(
          post_last_year.community_slug,
          :post,
          post_last_year.inner_id,
          user
        )

      assert not post_last_year.meta.can_undo_sink
    end

    test "can sink a post", ~m(user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      assert not post.meta.is_sunk

      {:ok, post} = CMS.Articles.sink(post)
      assert post.meta.is_sunk
      assert post.active_at == post.inserted_at
    end

    test "can undo sink post", ~m(user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, post} = CMS.Articles.sink(post)
      assert post.meta.is_sunk
      assert post.meta.last_active_at == post.active_at

      {:ok, post} = CMS.Articles.undo_sink(post)
      assert not post.meta.is_sunk
      assert post.active_at == post.meta.last_active_at
    end

    test "can not undo sink to old post", ~m()a do
      {:ok, post_last_year} = db_insert(:post, %{title: "last year", inserted_at: @last_year})

      {:error, reason} = CMS.Articles.undo_sink(post_last_year)
      is_error?(reason, :undo_sink_old_article)
    end
  end

  describe "[cms post batch delete]" do
    test "can batch delete posts with inner_ids", ~m(user community post_attrs)a do
      {:ok, post1} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, post2} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, post3} = CMS.Articles.create(community, :post, post_attrs, user)

      CMS.Articles.batch_mark_delete(community.slug, :post, [
        post1.inner_id,
        post2.inner_id
      ])

      {:ok, post1} = ORM.find(Post, post1.id)
      {:ok, post2} = ORM.find(Post, post2.id)
      {:ok, post3} = ORM.find(Post, post3.id)

      assert post1.mark_delete == true
      assert post2.mark_delete == true
      assert post3.mark_delete == false
    end

    test "can undo batch delete posts with inner_ids", ~m(user community post_attrs)a do
      {:ok, post1} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, post2} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _post3} = CMS.Articles.create(community, :post, post_attrs, user)

      CMS.Articles.batch_mark_delete(community.slug, :post, [
        post1.inner_id,
        post2.inner_id
      ])

      CMS.Articles.batch_undo_mark_delete(community.slug, :post, [
        post1.inner_id,
        post2.inner_id
      ])

      {:ok, post1} = ORM.find(Post, post1.id)
      {:ok, post2} = ORM.find(Post, post2.id)
      # {:ok, } = ORM.find(Post, post3.id)

      assert post1.mark_delete == false
      assert post2.mark_delete == false
    end
  end

  describe "[cms post document]" do
    test "will create related document after create", ~m(user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, post} = CMS.Articles.read(post.community_slug, :post, post.inner_id)

      assert not is_nil(post.document.html)
      {:ok, post} = CMS.Articles.read(post.community_slug, :post, post.inner_id, user)
      assert not is_nil(post.document.html)

      {:ok, article_doc} = ORM.find_by(ArticleDocument, %{article_id: post.id, thread: :post})
      {:ok, post_doc} = ORM.find_by(PostDocument, %{post_id: post.id})

      assert post.document.json == post_doc.json
      assert article_doc.json == post_doc.json
    end

    test "delete post should also delete related document", ~m(user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _article_doc} = ORM.find_by(ArticleDocument, %{article_id: post.id, thread: :post})
      {:ok, _post_doc} = ORM.find_by(PostDocument, %{post_id: post.id})

      {:ok, _} = CMS.Articles.delete(post)

      {:error, _} = ORM.find(Post, post.id)
      {:error, _} = ORM.find_by(ArticleDocument, %{article_id: post.id, thread: :post})
      {:error, _} = ORM.find_by(PostDocument, %{post_id: post.id})
    end

    test "update post should also update related document", ~m(user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      body = mock_rich_text(~s(new content))
      {:ok, post} = CMS.Articles.update(post, %{body: body})

      {:ok, article_doc} = ORM.find_by(ArticleDocument, %{article_id: post.id, thread: :post})
      {:ok, post_doc} = ORM.find_by(PostDocument, %{post_id: post.id})

      assert String.contains?(post_doc.json, "new content")
      assert String.contains?(article_doc.json, "new content")
    end
  end
end
