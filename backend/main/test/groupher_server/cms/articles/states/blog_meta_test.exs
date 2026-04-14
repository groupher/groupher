defmodule GroupherServer.Test.CMS.BlogMeta do
  @moduledoc false
  use GroupherServer.TestMate

  @default_article_meta Embeds.ArticleMeta.default_meta()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    blog_attrs = mock_attrs(:blog, %{community_id: community.id})

    {:ok, ~m(user community blog_attrs)a}
  end

  describe "[cms blog meta info]" do
    test "can get default meta info", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      {:ok, blog} = ORM.find_by(Blog, id: blog.id)
      meta = blog.meta |> Map.from_struct() |> Map.delete(:id)

      assert meta == @default_article_meta |> Map.merge(%{thread: :blog})
    end

    test "is_edited flag should set to true after blog updated",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      {:ok, blog} = ORM.find_by(Blog, id: blog.id)

      assert not blog.meta.is_edited

      {:ok, _} = CMS.Articles.update(blog, %{"title" => "new title"})
      {:ok, blog} = ORM.find_by(Blog, id: blog.id)

      assert blog.meta.is_edited
    end

    test "blog's lock/undo_lock article should work", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      assert not blog.meta.is_comment_locked

      {:ok, _} = CMS.Articles.lock_comments(blog)
      {:ok, blog} = ORM.find_by(Blog, id: blog.id)

      assert blog.meta.is_comment_locked

      {:ok, _} = CMS.Articles.undo_lock_comments(blog)
      {:ok, blog} = ORM.find_by(Blog, id: blog.id)

      assert not blog.meta.is_comment_locked
    end

    # TODO:
    # test "blog with image should have imageCount in meta" do
    # end

    # TODO:
    # test "blog with video should have imageCount in meta" do
    # end
  end
end
