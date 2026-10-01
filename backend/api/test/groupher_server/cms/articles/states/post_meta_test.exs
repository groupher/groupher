defmodule GroupherServer.Test.CMS.PostMeta do
  @moduledoc false
  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    post_attrs = mock_attrs(:post, %{community_id: community.id})

    {:ok, ~m(user community post_attrs)a}
  end

  describe "[cms post meta info]" do
    test "can get default meta info", ~m(user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      post = Repo.get!(CMS.Model.Article, post.id)
      refute post.is_edited
      refute post.comments_locked
      refute post.is_sunk
    end

    test "is_edited flag should set to true after post updated", ~m(user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      assert not Repo.get!(CMS.Model.Article, post.id).is_edited

      {:ok, _} =
        CMS.Articles.update(
          post,
          %{"title" => "new title", expected_version: post.version},
          user,
          Ecto.UUID.generate()
        )

      assert Repo.get!(CMS.Model.Article, post.id).is_edited
    end

    test "post's lock/undo_lock article should work", ~m(user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      assert not post.meta.is_comment_locked

      {:ok, _} = CMS.Articles.lock_comments(post.id, user)
      assert Repo.get!(CMS.Model.Article, post.id).comments_locked

      {:ok, _} = CMS.Articles.undo_lock_comments(post.id, user)
      refute Repo.get!(CMS.Model.Article, post.id).comments_locked
    end
  end
end
