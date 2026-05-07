defmodule GroupherServer.Test.CMS.PostArchive do
  @moduledoc false
  use GroupherServer.TestMate

  @archive_threshold get_config(:article, :archive_threshold)
  @post_archive_threshold Datetime.shift(
                            @now,
                            @archive_threshold[:post] || @archive_threshold[:default]
                          )

  setup do
    {:ok, user} = db_insert(:user)
    # {:ok, post} = db_insert(:post)
    community_attrs = mock_attrs(:community)
    {:ok, community} = CMS.Communities.create(community_attrs, user)

    {:ok, post_long_ago} = db_insert(:post, %{title: "last week", inserted_at: @last_year})
    db_insert_multi(:post, 5)

    {:ok, ~m(user community post_long_ago)a}
  end

  describe "[cms post archive]" do
    test "can archive posts", ~m(post_long_ago)a do
      {:ok, _} = CMS.Articles.archive(:post)

      archived_posts =
        Post
        |> where([article], article.inserted_at < ^@post_archive_threshold)
        |> Repo.all()

      assert length(archived_posts) == 1
      archived_post = archived_posts |> List.first()
      assert archived_post.id == post_long_ago.id
    end

    test "can not edit archived post" do
      {:ok, _} = CMS.Articles.archive(:post)

      archived_posts =
        Post
        |> where([article], article.inserted_at < ^@post_archive_threshold)
        |> Repo.all()

      archived_post = archived_posts |> List.first()
      {:error, reason} = CMS.Articles.update(archived_post, %{"title" => "new title"})
      assert reason |> is_error?(:archived)
    end

    test "can not delete archived post" do
      {:ok, _} = CMS.Articles.archive(:post)

      archived_posts =
        Post
        |> where([article], article.inserted_at < ^@post_archive_threshold)
        |> Repo.all()

      archived_post = archived_posts |> List.first()

      {:error, reason} = CMS.Articles.mark_delete(archived_post)
      assert reason |> is_error?(:archived)
    end
  end
end
