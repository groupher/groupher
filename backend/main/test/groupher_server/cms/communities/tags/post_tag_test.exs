defmodule GroupherServer.Test.CMS.Communities.Tags.PostTagTest do
  @moduledoc false
  use GroupherServer.TestTools

  alias CMS.Model.CommunityTag

  alias GroupherServer.CMS

  setup do
    {community, post, post_attrs, user} = mock_article(:post)
    article_tag_attrs = mock_attrs(:community_tag)
    article_tag_attrs2 = mock_attrs(:community_tag)

    {:ok, ~m(user community post post_attrs article_tag_attrs article_tag_attrs2)a}
  end

  describe "[post tag reindex]" do
    test "can reindex group of tags", ~m(community article_tag_attrs user)a do
      attrs = Map.merge(article_tag_attrs, %{group: "group1"})
      {:ok, article_tag1} = CMS.Communities.create_tag(community, :post, attrs, user)
      {:ok, article_tag2} = CMS.Communities.create_tag(community, :post, attrs, user)
      {:ok, article_tag3} = CMS.Communities.create_tag(community, :post, attrs, user)
      {:ok, article_tag4} = CMS.Communities.create_tag(community, :post, attrs, user)

      attrs = Map.merge(article_tag_attrs, %{group: "group2"})
      {:ok, article_tag5} = CMS.Communities.create_tag(community, :post, attrs, user)

      tags_with_index = [
        %{
          id: article_tag1.id,
          index: 1
        },
        %{
          id: article_tag2.id,
          index: 2
        },
        %{
          id: article_tag3.id,
          index: 3
        },
        %{
          id: article_tag4.id,
          index: 4
        }
      ]

      CMS.Communities.reindex_tags(community, :post, "group1", tags_with_index)

      {:ok, article_tag1_after} = ORM.find(CommunityTag, article_tag1.id)
      {:ok, article_tag2_after} = ORM.find(CommunityTag, article_tag2.id)
      {:ok, article_tag3_after} = ORM.find(CommunityTag, article_tag3.id)
      {:ok, article_tag4_after} = ORM.find(CommunityTag, article_tag4.id)
      {:ok, article_tag5_after} = ORM.find(CommunityTag, article_tag5.id)

      assert article_tag1_after.index === 1
      assert article_tag2_after.index === 2
      assert article_tag3_after.index === 3
      assert article_tag4_after.index === 4

      assert article_tag5_after.index === 0
    end
  end

  describe "[post tag CRUD]" do
    test "create article tag with valid data", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      assert article_tag.title == article_tag_attrs.title
      assert article_tag.group == article_tag_attrs.group
    end

    test "create article tag with extra & icon data", ~m(community article_tag_attrs user)a do
      tag_attrs = Map.merge(article_tag_attrs, %{extra: ["menuID", "menuID2"], icon: "icon addr"})
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, tag_attrs, user)

      assert article_tag.extra == ["menuID", "menuID2"]
      assert article_tag.icon == "icon addr"
    end

    test "can update an article tag", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)

      new_attrs = article_tag_attrs |> Map.merge(%{title: "new title", layout: "simple"})

      {:ok, article_tag} = CMS.Communities.update_tag(article_tag.id, new_attrs)

      assert article_tag.title == "new title"
      assert article_tag.layout == "simple"
    end

    test "create article tag with non-exist community fails", ~m(article_tag_attrs user)a do
      assert {:error, _} =
               CMS.Communities.create_tag(
                 %Community{slug: non_exist_slug()},
                 :post,
                 article_tag_attrs,
                 user
               )
    end

    test "tag can be deleted", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, article_tag} = ORM.find(CommunityTag, article_tag.id)

      {:ok, _} = CMS.Communities.delete_tag(article_tag.id)

      assert {:error, _} = ORM.find(CommunityTag, article_tag.id)
    end

    test "assoc tag should be delete after tag deleted",
         ~m(community post article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, article_tag2} = CMS.Communities.create_tag(community, :post, article_tag_attrs2, user)

      {:ok, post} = CMS.Communities.set_tag(post, article_tag.id)
      {:ok, post} = CMS.Communities.set_tag(post, article_tag2.id)

      {:ok, post} = ORM.find(Post, post.id, preload: :community_tags)
      assert exist_in?(article_tag, post.community_tags)
      assert exist_in?(article_tag2, post.community_tags)

      {:ok, _} = CMS.Communities.delete_tag(article_tag.id)

      {:ok, post} = ORM.find(Post, post.id, preload: :community_tags)
      assert not exist_in?(article_tag, post.community_tags)
      assert exist_in?(article_tag2, post.community_tags)

      {:ok, _} = CMS.Communities.delete_tag(article_tag2.id)

      {:ok, post} = ORM.find(Post, post.id, preload: :community_tags)
      assert not exist_in?(article_tag, post.community_tags)
      assert not exist_in?(article_tag2, post.community_tags)
    end
  end

  describe "[create/update post with tags]" do
    test "can create post with existed article tags",
         ~m(community user post_attrs article_tag_attrs article_tag_attrs2)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, article_tag2} = CMS.Communities.create_tag(community, :post, article_tag_attrs2, user)

      post_with_tags = Map.merge(post_attrs, %{community_tags: [article_tag.id, article_tag2.id]})

      {:ok, created} = CMS.Articles.create(community, :post, post_with_tags, user)
      {:ok, post} = ORM.find(Post, created.id, preload: :community_tags)

      assert exist_in?(article_tag, post.community_tags)
      assert exist_in?(article_tag2, post.community_tags)
    end

    test "can not create post with other community's article tags",
         ~m(community user post_attrs article_tag_attrs article_tag_attrs2)a do
      {:ok, community2} = mock_community()
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, article_tag2} = CMS.Communities.create_tag(community2, :post, article_tag_attrs2, user)

      post_with_tags = Map.merge(post_attrs, %{community_tags: [article_tag.id, article_tag2.id]})

      {:error, reason} = CMS.Articles.create(community, :post, post_with_tags, user)
      is_error?(reason, :invalid_domain_tag)
    end
  end

  describe "[post tag set /unset]" do
    test "can set a tag ", ~m(community post article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, article_tag2} = CMS.Communities.create_tag(community, :post, article_tag_attrs2, user)

      {:ok, post} = CMS.Communities.set_tag(post, article_tag.id)
      assert post.community_tags |> length == 1
      assert exist_in?(article_tag, post.community_tags)

      {:ok, post} = CMS.Communities.set_tag(post, article_tag2.id)
      assert post.community_tags |> length == 2
      assert exist_in?(article_tag, post.community_tags)
      assert exist_in?(article_tag2, post.community_tags)

      {:ok, post} = CMS.Communities.unset_tag(post, article_tag.id)
      assert post.community_tags |> length == 1
      assert not exist_in?(article_tag, post.community_tags)
      assert exist_in?(article_tag2, post.community_tags)

      {:ok, post} = CMS.Communities.unset_tag(post, article_tag2.id)
      assert post.community_tags |> length == 0
      assert not exist_in?(article_tag, post.community_tags)
      assert not exist_in?(article_tag2, post.community_tags)
    end

    test "can not set dup tag ", ~m(community post article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, post} = CMS.Communities.set_tag(post, article_tag.id)
      {:ok, post} = CMS.Communities.set_tag(post, article_tag.id)

      assert post.community_tags |> length == 1
    end
  end
end
