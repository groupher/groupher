defmodule GroupherServer.Test.Mutation.Articles.PostEmotion do
  @moduledoc false

  use GroupherServer.TestMate

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

      assert article |> get_in(["emotions", "beerCount"]) == 1
      assert get_in(article, ["emotions", "viewerHasBeered"])
    end

    test "login user can undo emotion to a post", ~m(community post user owner_conn)a do
      {:ok, _} = CMS.Articles.emotion(post, :beer, user)

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        emotion: "BEER"
      }

      article = owner_conn |> gq_mutation(Schema.m(:undo_emotion_article, :post), variables)

      assert article |> get_in(["emotions", "beerCount"]) == 0
      assert not get_in(article, ["emotions", "viewerHasBeered"])
    end

    test "duplicate same emotion counts as 1", ~m(community post user_conn)a do
      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        emotion: "BEER"
      }

      article = user_conn |> gq_mutation(Schema.m(:emotion_article, :post), variables)
      assert article |> get_in(["emotions", "beerCount"]) == 1
      assert get_in(article, ["emotions", "viewerHasBeered"])

      article2 = user_conn |> gq_mutation(Schema.m(:emotion_article, :post), variables)
      assert article2 |> get_in(["emotions", "beerCount"]) == 1
      assert get_in(article2, ["emotions", "viewerHasBeered"])
    end

    test "different emotions from different users both get counted",
         ~m(community post user_conn user2_conn)a do
      variables_beer = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        emotion: "BEER"
      }

      article = user_conn |> gq_mutation(Schema.m(:emotion_article, :post), variables_beer)
      assert article |> get_in(["emotions", "beerCount"]) == 1

      variables_heart = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        emotion: "HEART"
      }

      article2 = user2_conn |> gq_mutation(Schema.m(:emotion_article, :post), variables_heart)
      assert article2 |> get_in(["emotions", "beerCount"]) == 1

      {:ok, current_post} = CMS.FrontDesk.article(community.slug, :post, post.inner_id)
      assert current_post.emotions.beer_count == 1
      assert current_post.emotions.heart_count == 1
    end
  end
end
