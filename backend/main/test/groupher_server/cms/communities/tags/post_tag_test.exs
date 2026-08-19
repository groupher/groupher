defmodule GroupherServer.Test.CMS.Communities.Tags.PostTagTest do
  @moduledoc false
  use GroupherServer.TestMate

  alias CMS.Communities.TagStats
  alias CMS.Model.{CommunityTag, CommunityTagStat}

  alias GroupherServer.CMS

  setup do
    {community, post, post_attrs, user} = mock_article(:post)
    article_tag_attrs = mock_attrs(:community_tag)
    article_tag_attrs2 = mock_attrs(:community_tag)

    {:ok, ~m(user community post post_attrs article_tag_attrs article_tag_attrs2)a}
  end

  describe "[post tag reindex]" do
    test "can reindex group of tags", ~m(community article_tag_attrs user)a do
      {:ok, group1} = CMS.Communities.create_tag_group(community, :post, %{title: "group1"})
      {:ok, group2} = CMS.Communities.create_tag_group(community, :post, %{title: "group2"})

      attrs = Map.merge(article_tag_attrs, %{group_id: group1.id})
      {:ok, article_tag1} = CMS.Communities.create_tag(community, :post, attrs, user)

      {:ok, article_tag2} =
        CMS.Communities.create_tag(community, :post, unique_community_tag_attrs(attrs, "2"), user)

      {:ok, article_tag3} =
        CMS.Communities.create_tag(community, :post, unique_community_tag_attrs(attrs, "3"), user)

      {:ok, article_tag4} =
        CMS.Communities.create_tag(community, :post, unique_community_tag_attrs(attrs, "4"), user)

      attrs = Map.merge(article_tag_attrs, %{group_id: group2.id})

      {:ok, article_tag5} =
        CMS.Communities.create_tag(community, :post, unique_community_tag_attrs(attrs, "5"), user)

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

      CMS.Communities.reindex_tags(community, :post, group1.id, tags_with_index)

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

    test "can batch reindex tags across groups", ~m(community article_tag_attrs user)a do
      {:ok, group1} = CMS.Communities.create_tag_group(community, :post, %{title: "group1"})
      {:ok, group2} = CMS.Communities.create_tag_group(community, :post, %{title: "group2"})

      attrs = Map.put(article_tag_attrs, :group_id, group1.id)
      {:ok, tag1} = CMS.Communities.create_tag(community, :post, attrs, user)

      {:ok, tag2} =
        CMS.Communities.create_tag(
          community,
          :post,
          unique_community_tag_attrs(attrs, "2"),
          user
        )

      assert {:ok, :pass} =
               CMS.Communities.reindex_tags(community, :post, [
                 %{id: tag1.id, group_id: group2.id, index: 3},
                 %{id: tag2.id, group_id: group2.id, index: 4}
               ])

      {:ok, tag1} = ORM.find(CommunityTag, tag1.id)
      {:ok, tag2} = ORM.find(CommunityTag, tag2.id)

      assert tag1.group_id == group2.id
      assert tag1.index == 3
      assert tag2.group_id == group2.id
      assert tag2.index == 4
    end

    test "rejects incomplete group reindex without changing any tag",
         ~m(community article_tag_attrs user)a do
      {:ok, group} = CMS.Communities.create_tag_group(community, :post, %{title: "group"})
      attrs = Map.put(article_tag_attrs, :group_id, group.id)
      {:ok, tag1} = CMS.Communities.create_tag(community, :post, attrs, user)

      {:ok, tag2} =
        CMS.Communities.create_tag(
          community,
          :post,
          unique_community_tag_attrs(attrs, "2"),
          user
        )

      assert {:error, %ErrorCat.Error{reason: :invalid_domain_tag}} =
               CMS.Communities.reindex_tags(community, :post, group.id, [
                 %{id: tag1.id, index: 9}
               ])

      {:ok, tag1} = ORM.find(CommunityTag, tag1.id)
      {:ok, tag2} = ORM.find(CommunityTag, tag2.id)

      assert tag1.index == 0
      assert tag2.index == 0
    end

    test "rejects duplicate and foreign tag ids before batch reindex",
         ~m(community article_tag_attrs user)a do
      {:ok, group} = CMS.Communities.create_tag_group(community, :post, %{title: "group"})
      attrs = Map.put(article_tag_attrs, :group_id, group.id)
      {:ok, tag} = CMS.Communities.create_tag(community, :post, attrs, user)

      assert {:error, %ErrorCat.Error{reason: :invalid_domain_tag}} =
               CMS.Communities.reindex_tags(community, :post, [
                 %{id: tag.id, group_id: group.id, index: 1},
                 %{id: tag.id, group_id: group.id, index: 2}
               ])

      {:ok, other_community} = mock_community()

      {:ok, other_group} =
        CMS.Communities.create_tag_group(other_community, :post, %{title: "other-group"})

      other_attrs = Map.put(unique_community_tag_attrs(attrs, "other"), :group_id, other_group.id)
      {:ok, other_tag} = CMS.Communities.create_tag(other_community, :post, other_attrs, user)

      assert {:error, %ErrorCat.Error{reason: :invalid_domain_tag}} =
               CMS.Communities.reindex_tags(community, :post, [
                 %{id: other_tag.id, group_id: group.id, index: 8}
               ])

      {:ok, tag} = ORM.find(CommunityTag, tag.id)
      {:ok, other_tag} = ORM.find(CommunityTag, other_tag.id)

      assert tag.index == 0
      assert other_tag.index == 0
    end

    test "can batch reindex tag groups", ~m(community)a do
      {:ok, group1} = CMS.Communities.create_tag_group(community, :post, %{title: "group1"})
      {:ok, group2} = CMS.Communities.create_tag_group(community, :post, %{title: "group2"})

      assert {:ok, :pass} =
               CMS.Communities.reindex_tag_groups(community, :post, [
                 %{id: group1.id, index: 6},
                 %{id: group2.id, index: 5}
               ])

      {:ok, group1} = ORM.find(CMS.Model.CommunityTagGroup, group1.id)
      {:ok, group2} = ORM.find(CMS.Model.CommunityTagGroup, group2.id)

      assert group1.index == 6
      assert group2.index == 5
    end
  end

  describe "[post tag CRUD]" do
    test "create article tag with valid data", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      assert article_tag.title == article_tag_attrs.title
      assert article_tag.group_id
    end

    test "can not create duplicate tag slug in same community and thread",
         ~m(community article_tag_attrs user)a do
      {:ok, _article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)

      dup_attrs =
        article_tag_attrs
        |> Map.merge(%{title: "another title"})

      assert {:error, changeset} = CMS.Communities.create_tag(community, :post, dup_attrs, user)
      assert Keyword.has_key?(changeset.errors, :slug)
    end

    test "can not update tag to duplicate slug in same community and thread",
         ~m(community article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, article_tag2} = CMS.Communities.create_tag(community, :post, article_tag_attrs2, user)

      attrs =
        article_tag_attrs2
        |> Map.merge(%{slug: article_tag.slug})

      assert {:error, changeset} = CMS.Communities.update_tag(article_tag2.id, attrs)
      assert Keyword.has_key?(changeset.errors, :slug)
    end

    test "create article tag with extra & marker data", ~m(community article_tag_attrs user)a do
      tag_attrs =
        Map.merge(article_tag_attrs, %{
          extra: ["menuID", "menuID2"],
          marker: %{type: "ICON", provider: "lucide", name: "tag", src: "/icons/lucide/tag.svg"}
        })

      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, tag_attrs, user)

      assert article_tag.extra == ["menuID", "menuID2"]

      assert article_tag.marker == %{
               type: :icon,
               provider: "lucide",
               name: "tag",
               src: "/icons/lucide/tag.svg"
             }
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
    test "can create post with existed community tags",
         ~m(community user post_attrs article_tag_attrs article_tag_attrs2)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, article_tag2} = CMS.Communities.create_tag(community, :post, article_tag_attrs2, user)

      {:ok, article_tag3} =
        CMS.Communities.create_tag(
          community,
          :post,
          unique_community_tag_attrs(article_tag_attrs, "3"),
          user
        )

      post_with_tags =
        Map.merge(post_attrs, %{
          community_tags: [article_tag.id, article_tag2.id, article_tag3.id]
        })

      {:ok, created} = CMS.Articles.create(community, :post, post_with_tags, user)
      {:ok, post} = ORM.find(Post, created.id, preload: :community_tags)

      assert exist_in?(article_tag, post.community_tags)
      assert exist_in?(article_tag2, post.community_tags)
      assert exist_in?(article_tag3, post.community_tags)

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      {:ok, stat2} = CMS.Communities.tag_stats(article_tag2)
      {:ok, stat3} = CMS.Communities.tag_stats(article_tag3)

      assert stat.contents_count == 1
      assert stat.today_contents_count == 1
      assert stat.today_stat_date == Datetime.today()

      assert stat2.contents_count == 1
      assert stat2.today_contents_count == 1
      assert stat3.contents_count == 1
      assert stat3.today_contents_count == 1
    end

    test "deduplicates tag ids in one set operation",
         ~m(community user post_attrs article_tag_attrs)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)

      post_with_tags =
        Map.put(post_attrs, :community_tags, [article_tag.id, article_tag.id, article_tag.id])

      {:ok, created} = CMS.Articles.create(community, :post, post_with_tags, user)
      {:ok, post} = ORM.find(Post, created.id, preload: :community_tags)

      assert Enum.map(post.community_tags, & &1.id) == [article_tag.id]

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 1
      assert stat.today_contents_count == 1
    end

    test "update post community tags keeps stats in sync",
         ~m(community user post_attrs article_tag_attrs article_tag_attrs2)a do
      article_tag_attrs3 = mock_attrs(:community_tag)

      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, article_tag2} = CMS.Communities.create_tag(community, :post, article_tag_attrs2, user)
      {:ok, article_tag3} = CMS.Communities.create_tag(community, :post, article_tag_attrs3, user)

      post_with_tags = Map.merge(post_attrs, %{community_tags: [article_tag.id, article_tag2.id]})
      {:ok, created} = CMS.Articles.create(community, :post, post_with_tags, user)

      update_attrs =
        post_attrs
        |> Map.merge(%{
          title: "updated post title",
          community_tags: [article_tag2.id, article_tag3.id]
        })

      {:ok, _updated} = CMS.Articles.update(created, update_attrs)

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      {:ok, stat2} = CMS.Communities.tag_stats(article_tag2)
      {:ok, stat3} = CMS.Communities.tag_stats(article_tag3)

      assert stat.contents_count == 1
      assert stat.today_contents_count == 1
      assert stat2.contents_count == 1
      assert stat2.today_contents_count == 1
      assert stat3.contents_count == 0
      assert stat3.today_contents_count == 0

      {:ok, %{article: _published, snapshot: nil}} =
        CMS.Articles.publish_draft(community, :post, created.article_hash_id, user)

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      {:ok, stat3} = CMS.Communities.tag_stats(article_tag3)
      assert stat.contents_count == 0
      assert stat3.contents_count == 1
    end

    test "can not create post with other community's community tags",
         ~m(community user post_attrs article_tag_attrs article_tag_attrs2)a do
      {:ok, community2} = mock_community()
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.Communities.create_tag(community2, :post, article_tag_attrs2, user)

      post_with_tags = Map.merge(post_attrs, %{community_tags: [article_tag.id, article_tag2.id]})

      {:error, reason} = CMS.Articles.create(community, :post, post_with_tags, user)
      is_error?(reason, {{:cms, :community}, :invalid_domain_tag})
    end
  end

  describe "[post tag set /unset]" do
    test "can set a tag ", ~m(community post article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, article_tag2} = CMS.Communities.create_tag(community, :post, article_tag_attrs2, user)

      {:ok, post} = CMS.Communities.set_tag(post, article_tag.id)
      assert post.community_tags |> length == 1
      assert exist_in?(article_tag, post.community_tags)

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 1
      assert stat.today_contents_count == 1

      {:ok, post} = CMS.Communities.set_tag(post, article_tag2.id)
      assert post.community_tags |> length == 2
      assert exist_in?(article_tag, post.community_tags)
      assert exist_in?(article_tag2, post.community_tags)

      {:ok, post} = CMS.Communities.unset_tag(post, article_tag.id)
      assert post.community_tags |> length == 1
      assert not exist_in?(article_tag, post.community_tags)
      assert exist_in?(article_tag2, post.community_tags)

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      {:ok, stat2} = CMS.Communities.tag_stats(article_tag2)
      assert stat.contents_count == 0
      assert stat.today_contents_count == 0
      assert stat2.contents_count == 1
      assert stat2.today_contents_count == 1

      {:ok, post} = CMS.Communities.unset_tag(post, article_tag2.id)
      assert post.community_tags |> length == 0
      assert not exist_in?(article_tag, post.community_tags)
      assert not exist_in?(article_tag2, post.community_tags)

      {:ok, stat2} = CMS.Communities.tag_stats(article_tag2)
      assert stat2.contents_count == 0
      assert stat2.today_contents_count == 0
    end

    test "can not set dup tag ", ~m(community post article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, post} = CMS.Communities.set_tag(post, article_tag.id)
      {:ok, post} = CMS.Communities.set_tag(post, article_tag.id)

      assert post.community_tags |> length == 1

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 1
      assert stat.today_contents_count == 1
    end

    test "set tag counts all contents but only today's contents",
         ~m(community post article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)

      {:ok, old_post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

      from(p in Post, where: p.id == ^old_post.id)
      |> Repo.update_all(set: [inserted_at: Datetime.beginning_of_day(yesterday_date())])

      {:ok, old_post} = ORM.find(Post, old_post.id, preload: :community_tags)

      {:ok, _post} = CMS.Communities.set_tag(post, article_tag.id)
      {:ok, _old_post} = CMS.Communities.set_tag(old_post, article_tag.id)

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 2
      assert stat.today_contents_count == 1
    end

    test "Trash and restore keep stats in sync",
         ~m(community post article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, post} = CMS.Communities.set_tag(post, article_tag.id)

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 1

      {:ok, trash_item} = CMS.Articles.trash(post, user)
      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 0
      assert stat.today_contents_count == 0

      {:ok, _} = CMS.Articles.restore_trashed(trash_item, user)
      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 1
      assert stat.today_contents_count == 1
    end

    test "repeated Trash does not decrement stats twice",
         ~m(community post article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, post} = CMS.Communities.set_tag(post, article_tag.id)

      {:ok, _} = CMS.Articles.trash(post, user)
      {:ok, post} = ORM.find(Post, post.id, preload: :community_tags)
      {:ok, _} = CMS.Articles.trash(post, user)

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 0
      assert stat.today_contents_count == 0
    end

    test "Trash does not decrement stats for an already illegal post",
         ~m(community post article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, post} = CMS.Communities.set_tag(post, article_tag.id)

      {:ok, _} =
        CMS.Articles.set_illegal(post, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"]
        })

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 0

      {:ok, post} = ORM.find(Post, post.id, preload: :community_tags)
      {:ok, _} = CMS.Articles.trash(post, user)

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 0
      assert stat.today_contents_count == 0
    end

    test "can rebuild tag stats from source data",
         ~m(community post article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, _post} = CMS.Communities.set_tag(post, article_tag.id)

      from(s in CommunityTagStat, where: s.community_tag_id == ^article_tag.id)
      |> Repo.update_all(set: [contents_count: 99, today_contents_count: 99])

      {:ok, stat} = CMS.Communities.rebuild_tag_stats(article_tag)
      assert stat.contents_count == 1
      assert stat.today_contents_count == 1

      {:ok, :pass} = CMS.Communities.rebuild_tag_stats_for_community(community, :post)
    end

    test "rebuild tag stats counts all contents but only today's contents",
         ~m(community post article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, old_post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

      {:ok, _post} = CMS.Communities.set_tag(post, article_tag.id)
      {:ok, _old_post} = CMS.Communities.set_tag(old_post, article_tag.id)

      from(p in Post, where: p.id == ^old_post.id)
      |> Repo.update_all(set: [inserted_at: Datetime.beginning_of_day(yesterday_date())])

      from(s in CommunityTagStat, where: s.community_tag_id == ^article_tag.id)
      |> Repo.update_all(set: [contents_count: 99, today_contents_count: 99])

      {:ok, stat} = CMS.Communities.rebuild_tag_stats(article_tag)
      assert stat.contents_count == 2
      assert stat.today_contents_count == 1
    end

    test "normalizes stale today stat date with stale today count",
         ~m(community post article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, _post} = CMS.Communities.set_tag(post, article_tag.id)

      from(s in CommunityTagStat, where: s.community_tag_id == ^article_tag.id)
      |> Repo.update_all(set: [today_stat_date: yesterday_date(), today_contents_count: 99])

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.today_stat_date == Datetime.today()
      assert stat.today_contents_count == 0
    end

    test "tag stats rejects mismatched article and tag thread",
         ~m(community post article_tag_attrs user)a do
      {:ok, blog_tag} = CMS.Communities.create_tag(community, :blog, article_tag_attrs, user)

      assert {:error, %ErrorCat.Error{reason: :invalid_domain_tag}} = TagStats.inc(post, blog_tag)
    end
  end
end
