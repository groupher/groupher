defmodule GroupherServer.Test.Mutation.Articles.PostEmotion do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community post)a}
  end

  describe "[post emotion]" do
    test "login user can emotion to a post", ~m(community post user_conn)a do
      variables = %{id: post.inner_id, community: community.slug, emotion: "BEER"}

      article = user_conn |> gq_mutation(Schema.m(:emotion_article, :post), variables)

      assert article |> get_in(["emotions", "beerCount"]) == 1
      assert get_in(article, ["emotions", "viewerHasBeered"])
    end

    test "login user can undo emotion to a post", ~m(community post user owner_conn)a do
      {:ok, _} = CMS.Articles.emotion(post, :beer, user)

      variables = %{id: post.inner_id, community: community.slug, emotion: "BEER"}

      article = owner_conn |> gq_mutation(Schema.m(:undo_emotion_article, :post), variables)

      assert article |> get_in(["emotions", "beerCount"]) == 0
      assert not get_in(article, ["emotions", "viewerHasBeered"])
    end
  end
end
