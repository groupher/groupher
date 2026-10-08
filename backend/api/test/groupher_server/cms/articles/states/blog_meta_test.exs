defmodule GroupherServer.Test.CMS.BlogMeta do
  @moduledoc false
  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    blog_attrs = mock_attrs(:blog, %{community_id: community.id})

    {:ok, ~m(user community blog_attrs)a}
  end

  describe "[cms blog meta info]" do
    test "can get default meta info", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      blog = Repo.get!(CMS.Model.Article, blog.id)
      refute blog.is_edited
      refute blog.comments_locked
    end

    test "is_edited flag should set to true after blog updated",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      assert not Repo.get!(CMS.Model.Article, blog.id).is_edited

      {:ok, _} =
        CMS.Articles.update(
          blog,
          %{"title" => "new title", expected_version: blog.version},
          user,
          Ecto.UUID.generate()
        )

      assert Repo.get!(CMS.Model.Article, blog.id).is_edited
    end

    test "blog's lock/undo_lock article should work", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      assert not blog.meta.is_comment_locked

      {:ok, _} = CMS.Articles.lock_comments(blog.id, user, community: community)
      assert Repo.get!(CMS.Model.Article, blog.id).comments_locked

      {:ok, _} = CMS.Articles.undo_lock_comments(blog.id, user, community: community)
      refute Repo.get!(CMS.Model.Article, blog.id).comments_locked
    end
  end
end
