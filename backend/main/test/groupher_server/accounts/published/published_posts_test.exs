defmodule GroupherServer.Test.Accounts.Published.Post do
  @moduledoc false

  use GroupherServer.TestTools

  @publish_count 10

  setup do
    {community, post, _, user} = mock_article(:post)

    {:ok, user2} = db_insert(:user)
    {:ok, community2} = db_insert(:community)

    {:ok, ~m(user user2 post community community2)a}
  end

  describe "[published posts]" do
    test "create post should update user published meta", ~m(community user2)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, _} = CMS.Articles.create(community, :post, post_attrs, user2)
      {:ok, _} = CMS.Articles.create(community, :post, post_attrs, user2)

      {:ok, user} = ORM.find(User, user2.id)
      assert user.meta.published_posts_count == 2
    end

    test "fresh user get empty paged published posts", ~m(user2)a do
      {:ok, results} = Accounts.paged_published_articles(user2, :post, %{page: 1, size: 20})

      assert results |> is_valid_pagination?(:raw)
      assert results.total_count == 0
    end

    @tag :skip_ci
    test "user can get paged published posts", ~m(user user2 community community2)a do
      pub_posts =
        Enum.reduce(1..@publish_count, [], fn _, acc ->
          post_attrs = mock_attrs(:post, %{community_id: community.id})
          {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

          acc ++ [post]
        end)

      pub_posts2 =
        Enum.reduce(1..@publish_count, [], fn _, acc ->
          post_attrs = mock_attrs(:post, %{community_id: community2.id})
          {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

          acc ++ [post]
        end)

      # unrelated other user
      Enum.reduce(1..5, [], fn _, acc ->
        post_attrs = mock_attrs(:post, %{community_id: community.id})
        {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user2)

        acc ++ [post]
      end)

      {:ok, results} = Accounts.paged_published_articles(user, :post, %{page: 1, size: 20})

      assert results |> is_valid_pagination?(:raw)
      assert results.total_count == @publish_count * 2 + 1

      random_post_id = pub_posts |> Enum.random() |> Map.get(:id)
      random_post_id2 = pub_posts2 |> Enum.random() |> Map.get(:id)
      assert results.entries |> Enum.any?(&(&1.id == random_post_id))
      assert results.entries |> Enum.any?(&(&1.id == random_post_id2))
    end
  end

  describe "[published post comments]" do
    test "can get published article comments", ~m(community post user)a do
      total_count = 10

      Enum.reduce(1..total_count, [], fn _, acc ->
        {:ok, comment} =
          CMS.create_comment(community, :post, post.inner_id, mock_comment(), user)

        acc ++ [comment]
      end)

      filter = %{page: 1, size: 20}
      {:ok, articles} = Accounts.paged_published_comments(user, :post, filter)

      entries = articles.entries
      article = entries |> List.first()

      assert article.article.id == post.id
      assert article.article.title == post.title
    end
  end
end
