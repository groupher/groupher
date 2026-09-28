defmodule GroupherServer.Test.Mutation.Articles.PostEmotion do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.ErrorCat.Error
  alias GroupherServer.CMS
  alias CMS.Articles.ErrorCat
  alias CMS.Model.{ArticleEmotionCount, ArticleUserEmotion}

  defp emotion_entry(emotions, type) do
    Enum.find(emotions || [], &(&1["type"] == String.upcase(to_string(type))))
  end

  setup do
    {community, post, _, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    user2_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user2_conn user guest_conn owner_conn community post)a}
  end

  describe "[post emotion]" do
    test "login user can emotion to a post", ~m(community post user_conn)a do
      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        emotion: "BEER"
      }

      article = user_conn |> gq_mutation(S.Article.m(:emotion_article, :post), variables)

      assert emotion_entry(article["articleStats"]["emotionCounts"], :beer)["count"] == 1
      assert get_in(article, ["interactionState", "viewerEmotion"]) == "BEER"

      assert %ArticleEmotionCount{
               count: 1,
               thread: :post,
               type: :beer
             } =
               Repo.get_by!(ArticleEmotionCount,
                 thread: :post,
                 article_id: post.id,
                 type: :beer
               )
    end

    test "login user can undo emotion to a post", ~m(community post user owner_conn)a do
      {:ok, _} = CMS.Interactions.emotion(post, :beer, user)

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        emotion: "BEER"
      }

      article = owner_conn |> gq_mutation(S.Article.m(:undo_emotion_article, :post), variables)

      assert is_nil(emotion_entry(article["articleStats"]["emotionCounts"], :beer))

      assert Repo.get_by!(ArticleEmotionCount,
               thread: :post,
               article_id: post.id,
               type: :beer
             ).count == 0
    end

    test "duplicate same emotion counts as 1", ~m(community post user_conn)a do
      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        emotion: "BEER"
      }

      article = user_conn |> gq_mutation(S.Article.m(:emotion_article, :post), variables)
      assert emotion_entry(article["articleStats"]["emotionCounts"], :beer)["count"] == 1
      assert get_in(article, ["interactionState", "viewerEmotion"]) == "BEER"

      article2 = user_conn |> gq_mutation(S.Article.m(:emotion_article, :post), variables)
      assert emotion_entry(article2["articleStats"]["emotionCounts"], :beer)["count"] == 1
      assert get_in(article2, ["interactionState", "viewerEmotion"]) == "BEER"
    end

    test "different emotions from different users both get counted",
         ~m(community post user_conn user2_conn)a do
      variables_beer = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        emotion: "BEER"
      }

      article = user_conn |> gq_mutation(S.Article.m(:emotion_article, :post), variables_beer)
      assert emotion_entry(article["articleStats"]["emotionCounts"], :beer)["count"] == 1

      variables_heart = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        emotion: "HEART"
      }

      article2 = user2_conn |> gq_mutation(S.Article.m(:emotion_article, :post), variables_heart)
      assert emotion_entry(article2["articleStats"]["emotionCounts"], :beer)["count"] == 1

      beer = Repo.get_by!(ArticleEmotionCount, thread: :post, article_id: post.id, type: :beer)
      heart = Repo.get_by!(ArticleEmotionCount, thread: :post, article_id: post.id, type: :heart)
      assert beer.count == 1
      assert heart.count == 1

      {:ok, current_post} = CMS.FrontDesk.article(community, :post, post.inner_id)
      counts = CMS.Interactions.counts([current_post])
      emotion_counts = counts[{:post, current_post.id}].emotion_counts
      assert %{type: :beer, count: 1} in emotion_counts
      assert %{type: :heart, count: 1} in emotion_counts
    end

    test "same user different emotions create one record per emotion", ~m(post user)a do
      {:ok, _} = CMS.Interactions.emotion(post, :beer, user)
      {:ok, _} = CMS.Interactions.emotion(post, :heart, user)

      {:ok, records} = ORM.find_all(ArticleUserEmotion, %{page: 1, size: 10})
      assert records.total_count == 2

      {:ok, _beer_record} =
        ORM.find_by(ArticleUserEmotion, %{post_id: post.id, user_id: user.id, emotion: "beer"})

      {:ok, _heart_record} =
        ORM.find_by(ArticleUserEmotion, %{post_id: post.id, user_id: user.id, emotion: "heart"})
    end

    test "generic Article emotion rejects the dedicated UPVOTE reaction", ~m(post user)a do
      assert {:error, %Error{reason: :emotion_not_allowed}} =
               CMS.Interactions.emotion(post, :upvote, user)

      refute Repo.get_by(ArticleUserEmotion,
               post_id: post.id,
               user_id: user.id,
               emotion: "upvote"
             )
    end

    test "generic Article emotion GraphQL enum excludes UPVOTE",
         ~m(community post user_conn)a do
      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        emotion: "UPVOTE"
      }

      assert mutation_error?(
               user_conn,
               S.Article.m(:emotion_article, :post),
               variables
             )
    end

    test "article emotion is rejected when disabled by dashboard thread settings",
         ~m(community post user_conn)a do
      {:ok, _} =
        CMS.Dashboard.update(community, :thread_emotions, %{
          post: [:heart]
        })

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        emotion: "BEER"
      }

      assert user_conn
             |> mutation_error?(
               S.Article.m(:emotion_article, :post),
               variables,
               ErrorCat.code(ErrorCat.emotion_not_allowed())
             )
    end
  end
end
