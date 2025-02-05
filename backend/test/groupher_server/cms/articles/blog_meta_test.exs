defmodule GroupherServer.Test.CMS.BlogMeta do
  @moduledoc false
  use GroupherServer.TestTools

  alias Helper.ORM
  alias GroupherServer.CMS

  alias CMS.Model.{Embeds, Author, Blog}

  @default_article_meta Embeds.ArticleMeta.default_meta()

  setup do
    {:ok, user} = db_insert(:user)
    # {:ok, blog} = db_insert(:blog)
    {:ok, community} = db_insert(:community)

    blog_attrs = mock_attrs(:blog, %{community_id: community.id})

    {:ok, ~m(user community blog_attrs)a}
  end

  describe "[cms blog meta info]" do
    test "can get default meta info", ~m(user community blog_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user.id)

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, blog} = ORM.find_by(Blog, id: blog.id)
      meta = blog.meta |> Map.from_struct() |> Map.delete(:id)

      assert meta == @default_article_meta |> Map.merge(%{thread: "BLOG"})
    end

    test "is_edited flag should set to true after blog updated",
         ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, blog} = ORM.find_by(Blog, id: blog.id)

      assert not blog.meta.is_edited

      {:ok, _} = CMS.update_article(blog, %{"title" => "new title"})
      {:ok, blog} = ORM.find_by(Blog, id: blog.id)

      assert blog.meta.is_edited
    end

    test "blog's lock/undo_lock article should work", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      assert not blog.meta.is_comment_locked

      {:ok, _} = CMS.lock_article_comments(:blog, blog.id)
      {:ok, blog} = ORM.find_by(Blog, id: blog.id)

      assert blog.meta.is_comment_locked

      {:ok, _} = CMS.undo_lock_article_comments(:blog, blog.id)
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
