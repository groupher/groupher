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
      attrs = Map.merge(article_tag_attrs, %{group: "group1"})
      {:ok, article_tag1} = CMS.Communities.create_tag(community, :post, attrs, user)

      {:ok, article_tag2} =
        CMS.Communities.create_tag(community, :post, unique_community_tag_attrs(attrs, "2"), user)

      {:ok, article_tag3} =
        CMS.Communities.create_tag(community, :post, unique_community_tag_attrs(attrs, "3"), user)

      {:ok, article_tag4} =
        CMS.Communities.create_tag(community, :post, unique_community_tag_attrs(attrs, "4"), user)

      attrs = Map.merge(article_tag_attrs, %{group: "group2"})

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

      assert stat.contents_count == 0
      assert stat.today_contents_count == 0
      assert stat2.contents_count == 1
      assert stat2.today_contents_count == 1
      assert stat3.contents_count == 1
      assert stat3.today_contents_count == 1
    end

    test "can not create post with other community's community tags",
         ~m(community user post_attrs article_tag_attrs article_tag_attrs2)a do
      {:ok, community2} = mock_community()
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.Communities.create_tag(community2, :post, article_tag_attrs2, user)

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

    test "mark delete and undo mark delete keeps stats in sync",
         ~m(community post article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, post} = CMS.Communities.set_tag(post, article_tag.id)

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 1

      {:ok, _} = CMS.Articles.mark_delete(post)
      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 0
      assert stat.today_contents_count == 0

      {:ok, post} = ORM.find(Post, post.id, preload: :community_tags)
      {:ok, _} = CMS.Articles.undo_mark_delete(post)
      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 1
      assert stat.today_contents_count == 1
    end

    test "repeated mark delete does not decrement stats twice",
         ~m(community post article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :post, article_tag_attrs, user)
      {:ok, post} = CMS.Communities.set_tag(post, article_tag.id)

      {:ok, _} = CMS.Articles.mark_delete(post)
      {:ok, post} = ORM.find(Post, post.id, preload: :community_tags)
      {:ok, _} = CMS.Articles.mark_delete(post)

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 0
      assert stat.today_contents_count == 0
    end

    test "mark delete does not decrement stats for already illegal post",
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
      {:ok, _} = CMS.Articles.mark_delete(post)

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

      assert {:error, {:invalid_domain_tag, _}} = TagStats.inc(post, blog_tag)
    end
  end
end
