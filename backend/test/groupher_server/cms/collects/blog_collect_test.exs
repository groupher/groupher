defmodule GroupherServer.Test.Collect.Blog do
  @moduledoc false
  use GroupherServer.TestTools

  alias Helper.ORM
  alias GroupherServer.CMS
  alias CMS.Model.Blog

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    blog_attrs = mock_attrs(:blog, %{community_id: community.id})

    {:ok, ~m(user user2 community blog_attrs)a}
  end

  describe "[cms blog collect]" do
    test "blog can be collect && collects_count should inc by 1",
         ~m(user user2 community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      {:ok, article_collect} = CMS.collect_article(:blog, blog.id, user)
      {:ok, article} = ORM.find(Blog, article_collect.blog_id)

      assert article.id == blog.id
      assert article.collects_count == 1

      {:ok, article_collect} = CMS.collect_article(:blog, blog.id, user2)
      {:ok, article} = ORM.find(Blog, article_collect.blog_id)

      assert article.collects_count == 2
    end

    test "blog can be undo collect && collects_count should dec by 1",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      {:ok, article_collect} = CMS.collect_article(:blog, blog.id, user)
      {:ok, article} = ORM.find(Blog, article_collect.blog_id)
      assert article.id == blog.id
      assert article.collects_count == 1

      {:ok, article_collect} = CMS.undo_collect_article(:blog, blog.id, user)
      {:ok, article} = ORM.find(Blog, article_collect.blog_id)
      assert article.collects_count == 0
    end

    test "can get collect_users", ~m(user user2 community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

      {:ok, _article} = CMS.collect_article(:blog, blog.id, user)
      {:ok, _article} = CMS.collect_article(:blog, blog.id, user2)

      {:ok, users} = CMS.collected_users(:blog, blog.id, %{page: 1, size: 2})

      assert users |> is_valid_pagination?(:raw)
      assert user_exist_in?(user, users.entries)
      assert user_exist_in?(user2, users.entries)
    end

    test "blog meta history should be updated", ~m(user user2 community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, _} = CMS.collect_article(:blog, blog.id, user)

      {:ok, article} = ORM.find(Blog, blog.id)
      assert user.id in article.meta.collected_user_ids

      {:ok, _} = CMS.collect_article(:blog, blog.id, user2)
      {:ok, article} = ORM.find(Blog, blog.id)

      assert user.id in article.meta.collected_user_ids
      assert user2.id in article.meta.collected_user_ids
    end

    test "blog meta history should be updated after undo collect",
         ~m(user user2 community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, _} = CMS.collect_article(:blog, blog.id, user)
      {:ok, _} = CMS.collect_article(:blog, blog.id, user2)

      {:ok, article} = ORM.find(Blog, blog.id)
      assert user.id in article.meta.collected_user_ids
      assert user2.id in article.meta.collected_user_ids

      {:ok, _} = CMS.undo_collect_article(:blog, blog.id, user2)
      {:ok, article} = ORM.find(Blog, blog.id)
      assert user2.id not in article.meta.collected_user_ids

      {:ok, _} = CMS.undo_collect_article(:blog, blog.id, user)
      {:ok, article} = ORM.find(Blog, blog.id)
      assert user.id not in article.meta.collected_user_ids
      assert user2.id not in article.meta.collected_user_ids
    end
  end
end
