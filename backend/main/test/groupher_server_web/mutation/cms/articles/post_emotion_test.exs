defmodule GroupherServer.Test.Mutation.Articles.PostEmotion do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.ArticleUserEmotion

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
        article: %{inner_id: post.inner_id, community: community.slug},
        emotion: "BEER"
      }

      article = user_conn |> gq_mutation(Schema.m(:emotion_article, :post), variables)

      assert emotion_entry(article["emotions"], :beer)["count"] == 1
      assert emotion_entry(article["emotions"], :beer)["viewerHasReacted"]
    end

    test "login user can undo emotion to a post", ~m(community post user owner_conn)a do
      {:ok, _} = CMS.Articles.emotion(post, :beer, user)

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        emotion: "BEER"
      }

      article = owner_conn |> gq_mutation(Schema.m(:undo_emotion_article, :post), variables)

      assert is_nil(emotion_entry(article["emotions"], :beer))
    end

    test "duplicate same emotion counts as 1", ~m(community post user_conn)a do
      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        emotion: "BEER"
      }

      article = user_conn |> gq_mutation(Schema.m(:emotion_article, :post), variables)
      assert emotion_entry(article["emotions"], :beer)["count"] == 1
      assert emotion_entry(article["emotions"], :beer)["viewerHasReacted"]

      article2 = user_conn |> gq_mutation(Schema.m(:emotion_article, :post), variables)
      assert emotion_entry(article2["emotions"], :beer)["count"] == 1
      assert emotion_entry(article2["emotions"], :beer)["viewerHasReacted"]
    end

    test "different emotions from different users both get counted",
         ~m(community post user_conn user2_conn)a do
      variables_beer = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        emotion: "BEER"
      }

      article = user_conn |> gq_mutation(Schema.m(:emotion_article, :post), variables_beer)
      assert emotion_entry(article["emotions"], :beer)["count"] == 1

      variables_heart = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        emotion: "HEART"
      }

      article2 = user2_conn |> gq_mutation(Schema.m(:emotion_article, :post), variables_heart)
      assert emotion_entry(article2["emotions"], :beer)["count"] == 1

      {:ok, current_post} = CMS.FrontDesk.article(community.slug, :post, post.inner_id)
      assert current_post.emotions.beer_count == 1
      assert current_post.emotions.heart_count == 1
    end

    test "same user different emotions create one record per emotion", ~m(post user)a do
      {:ok, _} = CMS.Articles.emotion(post, :beer, user)
      {:ok, _} = CMS.Articles.emotion(post, :heart, user)

      {:ok, records} = ORM.find_all(ArticleUserEmotion, %{page: 1, size: 10})
      assert records.total_count == 2

      {:ok, _beer_record} =
        ORM.find_by(ArticleUserEmotion, %{post_id: post.id, user_id: user.id, emotion: "beer"})

      {:ok, _heart_record} =
        ORM.find_by(ArticleUserEmotion, %{post_id: post.id, user_id: user.id, emotion: "heart"})
    end

    test "article emotion is rejected when disabled by dashboard thread settings",
         ~m(community post user_conn)a do
      {:ok, _} =
        CMS.Communities.update_dashboard(community, :thread_emotions, %{
          post: [:heart]
        })

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        emotion: "BEER"
      }

      assert user_conn
             |> mutation_error?(
               Schema.m(:emotion_article, :post),
               variables,
               ecode(:emotion_not_allowed)
             )
    end
  end
end
