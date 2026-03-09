defmodule GroupherServer.Test.CMS.Communities.Tags.BlogTagTest do
  @moduledoc false
  use GroupherServer.TestMate

  alias CMS.Model.CommunityTag

  alias GroupherServer.CMS

  setup do
    {community, blog, blog_attrs, user} = mock_article(:blog)

    article_tag_attrs = mock_attrs(:community_tag)
    article_tag_attrs2 = mock_attrs(:community_tag)

    {:ok, ~m(user community blog blog_attrs article_tag_attrs article_tag_attrs2)a}
  end

  describe "[blog tag CRUD]" do
    test "create article tag with valid data", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :blog, article_tag_attrs, user)
      assert article_tag.title == article_tag_attrs.title
      assert article_tag.group == article_tag_attrs.group
    end

    test "create article tag with extra & icon data", ~m(community article_tag_attrs user)a do
      tag_attrs = Map.merge(article_tag_attrs, %{extra: ["menuID", "menuID2"], icon: "icon addr"})
      {:ok, article_tag} = CMS.Communities.create_tag(community, :blog, tag_attrs, user)

      assert article_tag.extra == ["menuID", "menuID2"]
      assert article_tag.icon == "icon addr"
    end

    test "can update an article tag", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :blog, article_tag_attrs, user)

      new_attrs = article_tag_attrs |> Map.merge(%{title: "new title"})

      {:ok, article_tag} = CMS.Communities.update_tag(article_tag.id, new_attrs)
      assert article_tag.title == "new title"
    end

    test "create article tag with non-exist community fails", ~m(article_tag_attrs user)a do
      assert {:error, _} =
               CMS.Communities.create_tag(
                 %Community{slug: non_exist_slug()},
                 :blog,
                 article_tag_attrs,
                 user
               )
    end

    test "tag can be deleted", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :blog, article_tag_attrs, user)
      {:ok, article_tag} = ORM.find(CommunityTag, article_tag.id)

      {:ok, _} = CMS.Communities.delete_tag(article_tag.id)

      assert {:error, _} = ORM.find(CommunityTag, article_tag.id)
    end

    test "assoc tag should be delete after tag deleted",
         ~m(community blog article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :blog, article_tag_attrs, user)
      {:ok, article_tag2} = CMS.Communities.create_tag(community, :blog, article_tag_attrs2, user)

      {:ok, blog} = CMS.Communities.set_tag(blog, article_tag.id)
      {:ok, blog} = CMS.Communities.set_tag(blog, article_tag2.id)

      {:ok, blog} = ORM.find(Blog, blog.id, preload: :community_tags)
      assert exist_in?(article_tag, blog.community_tags)
      assert exist_in?(article_tag2, blog.community_tags)

      {:ok, _} = CMS.Communities.delete_tag(article_tag.id)

      {:ok, blog} = ORM.find(Blog, blog.id, preload: :community_tags)
      assert not exist_in?(article_tag, blog.community_tags)
      assert exist_in?(article_tag2, blog.community_tags)

      {:ok, _} = CMS.Communities.delete_tag(article_tag2.id)

      {:ok, blog} = ORM.find(Blog, blog.id, preload: :community_tags)
      assert not exist_in?(article_tag, blog.community_tags)
      assert not exist_in?(article_tag2, blog.community_tags)
    end
  end

  describe "[create/update blog with tags]" do
    test "can create blog with existed community tags",
         ~m(community user blog_attrs article_tag_attrs article_tag_attrs2)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :blog, article_tag_attrs, user)

      {:ok, article_tag2} = CMS.Communities.create_tag(community, :blog, article_tag_attrs2, user)

      blog_with_tags = Map.merge(blog_attrs, %{community_tags: [article_tag.id, article_tag2.id]})

      {:ok, created} = CMS.Articles.create(community, :blog, blog_with_tags, user)
      {:ok, blog} = ORM.find(Blog, created.id, preload: :community_tags)

      assert exist_in?(article_tag, blog.community_tags)
      assert exist_in?(article_tag2, blog.community_tags)
    end

    test "can not create blog with other community's community tags",
         ~m(community user blog_attrs article_tag_attrs article_tag_attrs2)a do
      {:ok, community2} = db_insert(:community)
      {:ok, article_tag} = CMS.Communities.create_tag(community, :blog, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.Communities.create_tag(community2, :blog, article_tag_attrs2, user)

      blog_with_tags = Map.merge(blog_attrs, %{community_tags: [article_tag.id, article_tag2.id]})

      {:error, reason} = CMS.Articles.create(community, :blog, blog_with_tags, user)
      is_error?(reason, :invalid_domain_tag)
    end
  end

  describe "[blog tag set /unset]" do
    test "can set a tag ", ~m(community blog article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :blog, article_tag_attrs, user)

      {:ok, article_tag2} = CMS.Communities.create_tag(community, :blog, article_tag_attrs2, user)

      {:ok, blog} = CMS.Communities.set_tag(blog, article_tag.id)
      assert blog.community_tags |> length == 1
      assert exist_in?(article_tag, blog.community_tags)

      {:ok, blog} = CMS.Communities.set_tag(blog, article_tag2.id)
      assert blog.community_tags |> length == 2
      assert exist_in?(article_tag, blog.community_tags)
      assert exist_in?(article_tag2, blog.community_tags)

      {:ok, blog} = CMS.Communities.unset_tag(blog, article_tag.id)
      assert blog.community_tags |> length == 1
      assert not exist_in?(article_tag, blog.community_tags)
      assert exist_in?(article_tag2, blog.community_tags)

      {:ok, blog} = CMS.Communities.unset_tag(blog, article_tag2.id)
      assert blog.community_tags |> length == 0
      assert not exist_in?(article_tag, blog.community_tags)
      assert not exist_in?(article_tag2, blog.community_tags)
    end

    test "can not set dup tag ", ~m(community blog article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :blog, article_tag_attrs, user)
      {:ok, blog} = CMS.Communities.set_tag(blog, article_tag.id)
      {:ok, blog} = CMS.Communities.set_tag(blog, article_tag.id)

      assert blog.community_tags |> length == 1
    end
  end
end
