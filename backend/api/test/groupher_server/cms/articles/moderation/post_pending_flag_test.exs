defmodule GroupherServer.Test.CMS.PostPendingFlag do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS

  @total_count 35

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    {:ok, community2} = mock_community(user)

    {_, _, _, _} = mock_article(:post, community2, user)

    posts =
      Enum.reduce(1..@total_count, [], fn _, acc ->
        {:ok, value} = CMS.Articles.create(community, :post, mock_attrs(:post), user)
        acc ++ [value]
      end)

    post_b = posts |> List.first()
    post_m = posts |> Enum.at(div(@total_count, 2))
    post_e = posts |> List.last()

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community user post_b post_m post_e)a}
  end

  describe "[pending posts flags]" do
    test "orders a multi-tag audit query by projected views", ~m(community user post_m)a do
      {:ok, tag} =
        CMS.Communities.create_tag(community, :post, mock_attrs(:community_tag), user)

      assert {:ok, _post} = CMS.Communities.set_tag(post_m, tag.id)
      assert {:ok, _post} = CMS.Articles.set_audit_failed(post_m.article_id, %{}, :operations)

      assert {:ok, %{entries: entries}} =
               CMS.Articles.paged_audit_failed(:post, %{
                 article_tags: [tag.slug],
                 order: :views,
                 page: 1,
                 size: 20
               })

      assert Enum.any?(entries, &(&1.id == post_m.id))
    end

    test "pending post can not be read", ~m(post_m)a do
      {:ok, _} =
        read_article(
          article_community(post_m),
          :post,
          post_m.inner_id
        )

      {:ok, _} =
        CMS.Articles.set_illegal(
          post_m.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"]
          },
          :operations
        )

      stable = Repo.get!(CMS.Model.Article, post_m.article_id)
      assert stable.moderation_state == :illegal

      assert Enum.all?(
               CMS.Model.ArticleCommunity
               |> Repo.all()
               |> Enum.filter(&(&1.article_id == post_m.article_id)),
               &(not &1.visible)
             )

      {:error, reason} =
        read_article(
          article_community(post_m),
          :post,
          post_m.inner_id
        )

      assert reason |> is_error?({{:cms, :article}, :pending})
    end

    test "author can read it's own pending post", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, _} =
        read_article(article_community(post), :post, post.inner_id)

      {:ok, _} =
        CMS.Articles.set_illegal(
          post.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"]
          },
          :operations
        )

      {:ok, post_read} =
        read_article(
          article_community(post),
          :post,
          post.inner_id,
          user
        )

      assert post_read.id == post.id

      {:ok, user2} = db_insert(:user)

      {:error, reason} =
        read_article(
          article_community(post),
          :post,
          post.inner_id,
          user2
        )

      assert reason |> is_error?({{:cms, :article}, :pending})
    end

    test "pending post can set/unset pending", ~m(post_m)a do
      {:ok, _} =
        read_article(
          article_community(post_m),
          :post,
          post_m.inner_id
        )

      {:ok, _} =
        CMS.Articles.set_illegal(
          post_m.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"]
          },
          :operations
        )

      stable = Repo.get!(CMS.Model.Article, post_m.article_id)
      assert stable.moderation_state == :illegal

      {:ok, _} = CMS.Articles.unset_illegal(post_m.article_id, %{}, :operations)

      stable = Repo.get!(CMS.Model.Article, post_m.article_id)
      assert stable.moderation_state == :legal

      {:ok, _} =
        read_article(
          article_community(post_m),
          :post,
          post_m.inner_id
        )
    end

    test "pending post's meta should have info", ~m(post_m)a do
      {:ok, _} =
        read_article(
          article_community(post_m),
          :post,
          post_m.inner_id
        )

      {:ok, _} =
        CMS.Articles.set_illegal(
          post_m.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"],
            illegal_articles: ["/post/#{post_m.id}"]
          },
          :operations
        )

      stable = Repo.get!(CMS.Model.Article, post_m.article_id)
      assert stable.moderation_state == :illegal
      assert stable.illegal_reason == ["some-reason"]
      assert stable.illegal_words == ["some-word"]

      stable = Repo.preload(stable, author: :user)
      user = stable.author.user
      assert user.meta.has_illegal_articles
      assert user.meta.illegal_articles == ["/post/#{post_m.id}"]

      {:ok, _} =
        CMS.Articles.unset_illegal(
          post_m.article_id,
          %{
            is_legal: true,
            illegal_reason: [],
            illegal_words: [],
            illegal_articles: ["/post/#{post_m.id}"]
          },
          :operations
        )

      stable = Repo.get!(CMS.Model.Article, post_m.article_id)
      assert stable.moderation_state == :legal
      assert stable.illegal_reason == []
      assert stable.illegal_words == []

      stable = Repo.preload(stable, author: :user)
      user = stable.author.user
      assert not user.meta.has_illegal_articles
      assert user.meta.illegal_articles == []
    end
  end
end
