defmodule GroupherServer.Test.CMS.ArticleCommunity.Blog do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, blog, _, user} = mock_article(:blog)
    {:ok, user2} = db_insert(:user)

    {:ok, home_community} = mock_community(user, %{slug: "home"})
    {:ok, blackhole} = mock_community(user, %{slug: "blackhole"})

    {:ok, community2} = mock_community(user)
    {:ok, community3} = mock_community(user)

    blog_attrs = mock_attrs(:blog, %{community_id: community.id})

    {:ok,
     ~m(user user2 community community2 community3 home_community blackhole blog blog_attrs)a}
  end

  describe "[article mirror/move]" do
    test "created blog has original community info", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, blog} = ORM.find(Blog, blog.id, preload: :original_community)

      assert blog.original_community_id == community.id
    end

    test "blog can be move to other community",
         ~m(user community community2 blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      assert blog.original_community_id == community.id

      {:ok, _} = CMS.move_article(community2, blog)

      {:ok, blog} = ORM.find(Blog, blog.id, preload: [:original_community, :communities])

      assert blog.original_community.id == community2.id
      assert exist_in?(community2, blog.communities)
    end

    test "tags should be clean after blog move to other community",
         ~m(user community community2 blog_attrs)a do
      article_tag_attrs = mock_attrs(:article_tag)
      article_tag_attrs2 = mock_attrs(:article_tag)

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, article_tag} = CMS.create_article_tag(community, :blog, article_tag_attrs, user)

      {:ok, article_tag2} = CMS.create_article_tag(community, :blog, article_tag_attrs2, user)

      {:ok, _} = CMS.set_article_tag(blog, article_tag.id)
      {:ok, blog} = CMS.set_article_tag(blog, article_tag2.id)

      assert blog.article_tags |> length == 2
      assert blog.original_community_id == community.id

      {:ok, _} = CMS.move_article(community2, blog)

      {:ok, blog} =
        ORM.find(Blog, blog.id, preload: [:original_community, :communities, :article_tags])

      assert blog.article_tags |> length == 0
      assert blog.original_community.id == community2.id
      assert exist_in?(community2, blog.communities)
    end

    test "blog move to other community with new tag",
         ~m(user community community2 blog_attrs)a do
      article_tag_attrs0 = mock_attrs(:article_tag)
      article_tag_attrs = mock_attrs(:article_tag)
      article_tag_attrs2 = mock_attrs(:article_tag)

      {:ok, article_tag0} = CMS.create_article_tag(community, :blog, article_tag_attrs0, user)

      {:ok, article_tag} = CMS.create_article_tag(community2, :blog, article_tag_attrs, user)

      {:ok, article_tag2} = CMS.create_article_tag(community2, :blog, article_tag_attrs2, user)

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, _} = CMS.set_article_tag(blog, article_tag0.id)
      {:ok, _} = CMS.set_article_tag(blog, article_tag.id)
      {:ok, _} = CMS.set_article_tag(blog, article_tag2.id)

      {:ok, blog} = ORM.find(Blog, blog.id, preload: [:article_tags])
      assert blog.article_tags |> length == 3

      {:ok, _} = CMS.move_article(community2, blog, [article_tag.id, article_tag2.id])

      {:ok, blog} =
        ORM.find(Blog, blog.id, preload: [:original_community, :communities, :article_tags])

      assert blog.original_community.id == community2.id
      assert blog.article_tags |> length == 2

      assert not exist_in?(article_tag0, blog.article_tags)
      assert exist_in?(article_tag, blog.article_tags)
      assert exist_in?(article_tag2, blog.article_tags)
    end

    test "blog can be mirror to other community",
         ~m(user community community2 blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      {:ok, blog} = ORM.find(Blog, blog.id, preload: :communities)
      assert blog.communities |> length == 1

      assert exist_in?(community, blog.communities)

      {:ok, _} = CMS.mirror_article(community2, blog)

      {:ok, blog} = ORM.find(Blog, blog.id, preload: :communities)
      assert blog.communities |> length == 2

      assert exist_in?(community, blog.communities)
      assert exist_in?(community2, blog.communities)
    end

    test "blog can be mirror to other community with tags",
         ~m(user community community2 blog_attrs)a do
      article_tag_attrs = mock_attrs(:article_tag)
      article_tag_attrs2 = mock_attrs(:article_tag)
      {:ok, article_tag} = CMS.create_article_tag(community2, :blog, article_tag_attrs, user)

      {:ok, article_tag2} = CMS.create_article_tag(community2, :blog, article_tag_attrs2, user)

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      {:ok, _} =
        CMS.mirror_article(community2, blog, [
          article_tag.id,
          article_tag2.id
        ])

      {:ok, blog} = ORM.find(Blog, blog.id, preload: :article_tags)
      assert blog.article_tags |> length == 2

      assert exist_in?(article_tag, blog.article_tags)
      assert exist_in?(article_tag2, blog.article_tags)
    end

    test "blog can be unmirror from community",
         ~m(user community community2 community3 blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, _} = CMS.mirror_article(community2, blog)
      {:ok, _} = CMS.mirror_article(community3, blog)

      {:ok, blog} = ORM.find(Blog, blog.id, preload: :communities)
      assert blog.communities |> length == 3

      {:ok, _} = CMS.unmirror_article(community3, blog)
      {:ok, blog} = ORM.find(Blog, blog.id, preload: :communities)
      assert blog.communities |> length == 2

      assert not exist_in?(community3, blog.communities)
    end

    test "blog can be unmirror from community with tags",
         ~m(user community community2 community3 blog_attrs)a do
      article_tag_attrs2 = mock_attrs(:article_tag)
      article_tag_attrs3 = mock_attrs(:article_tag)

      {:ok, article_tag2} = CMS.create_article_tag(community2, :blog, article_tag_attrs2, user)
      {:ok, article_tag3} = CMS.create_article_tag(community3, :blog, article_tag_attrs3, user)

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, _} = CMS.mirror_article(community2, blog, [article_tag2.id])
      {:ok, _} = CMS.mirror_article(community3, blog, [article_tag3.id])

      {:ok, _} = CMS.unmirror_article(community3, blog)
      {:ok, blog} = ORM.find(Blog, blog.id, preload: :article_tags)

      assert exist_in?(article_tag2, blog.article_tags)
      assert not exist_in?(article_tag3, blog.article_tags)
    end

    test "blog can not unmirror from original community",
         ~m(user community community2 community3 blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, _} = CMS.mirror_article(community2, blog)
      {:ok, _} = CMS.mirror_article(community3, blog)

      {:ok, blog} = ORM.find(Blog, blog.id, preload: :communities)
      assert blog.communities |> length == 3

      {:error, reason} = CMS.unmirror_article(community, blog)
      assert reason |> is_error?(:mirror_article)
    end

    test "blog can be mirror to home", ~m(community home_community blog_attrs user)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      assert blog.original_community_id == community.id

      {:ok, _} = CMS.mirror_to_home(home_community, blog)

      {:ok, blog} = ORM.find(Blog, blog.id, preload: [:original_community, :communities])

      assert blog.original_community_id == community.id
      assert blog.communities |> length == 2

      assert exist_in?(community, blog.communities)
      assert exist_in?(home_community, blog.communities)

      filter = %{page: 1, size: 10, community: community.slug}
      {:ok, paged_articles} = CMS.paged_articles(:blog, filter)

      assert exist_in?(blog, paged_articles.entries)
      assert paged_articles.total_count === 2

      filter = %{page: 1, size: 10, community: home_community.slug}
      {:ok, paged_articles} = CMS.paged_articles(:blog, filter)

      assert exist_in?(blog, paged_articles.entries)
      assert paged_articles.total_count === 1
    end

    test "blog can be mirror to home with tags", ~m(community home_community blog_attrs user)a do
      article_tag_attrs0 = mock_attrs(:article_tag)
      article_tag_attrs = mock_attrs(:article_tag)

      {:ok, article_tag0} =
        CMS.create_article_tag(home_community, :blog, article_tag_attrs0, user)

      {:ok, article_tag} = CMS.create_article_tag(home_community, :blog, article_tag_attrs, user)

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      assert blog.original_community_id == community.id

      {:ok, _} = CMS.mirror_to_home(home_community, blog, [article_tag0.id, article_tag.id])

      {:ok, blog} =
        ORM.find(Blog, blog.id, preload: [:original_community, :communities, :article_tags])

      assert blog.original_community_id == community.id
      assert blog.communities |> length == 2

      assert exist_in?(community, blog.communities)
      assert exist_in?(home_community, blog.communities)

      assert blog.article_tags |> length == 2
      assert exist_in?(article_tag0, blog.article_tags)
      assert exist_in?(article_tag, blog.article_tags)

      filter = %{page: 1, size: 10, community: community.slug}
      {:ok, paged_articles} = CMS.paged_articles(:blog, filter)

      assert exist_in?(blog, paged_articles.entries)
      assert paged_articles.total_count === 2

      filter = %{page: 1, size: 10, community: home_community.slug}
      {:ok, paged_articles} = CMS.paged_articles(:blog, filter)

      assert exist_in?(blog, paged_articles.entries)
      assert paged_articles.total_count === 1
    end

    test "blog can be move to blackhole", ~m(community blackhole blog_attrs user)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      assert blog.original_community_id == community.id

      {:ok, _} = CMS.move_to_blackhole(blackhole, blog)

      {:ok, blog} = ORM.find(Blog, blog.id, preload: [:original_community, :communities])

      assert blog.original_community.id == blackhole.id
      assert blog.communities |> length == 1

      assert exist_in?(blackhole, blog.communities)

      filter = %{page: 1, size: 10, community: blackhole.slug}
      {:ok, paged_articles} = CMS.paged_articles(:blog, filter)

      assert exist_in?(blog, paged_articles.entries)
      assert paged_articles.total_count === 1
    end

    test "blog can be move to blackhole with tags", ~m(community blackhole blog_attrs user)a do
      article_tag_attrs0 = mock_attrs(:article_tag)
      article_tag_attrs = mock_attrs(:article_tag)

      {:ok, article_tag0} =
        CMS.create_article_tag(blackhole, :blog, article_tag_attrs0, user)

      {:ok, article_tag} =
        CMS.create_article_tag(blackhole, :blog, article_tag_attrs, user)

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, _} = CMS.set_article_tag(blog, article_tag0.id)

      assert blog.original_community_id == community.id

      {:ok, _} = CMS.move_to_blackhole(blackhole, blog, [article_tag.id])

      {:ok, blog} =
        ORM.find(Blog, blog.id, preload: [:original_community, :communities, :article_tags])

      assert blog.original_community.id == blackhole.id
      assert blog.communities |> length == 1
      assert blog.article_tags |> length == 1

      assert exist_in?(blackhole, blog.communities)
      assert exist_in?(article_tag, blog.article_tags)
    end
  end
end
