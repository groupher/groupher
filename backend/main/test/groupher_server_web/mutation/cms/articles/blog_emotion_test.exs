defmodule GroupherServer.Test.Mutation.Articles.BlogEmotion do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, blog, _, user} = mock_article(:blog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community blog)a}
  end

  describe "[blog emotion]" do
    test "login user can emotion to a blog", ~m(community blog user_conn)a do
      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}, emotion: "BEER"}

      article = user_conn |> gq_mutation(Schema.m(:emotion_article, :blog), variables)

      assert article |> get_in(["emotions", "beerCount"]) == 1
      assert get_in(article, ["emotions", "viewerHasBeered"])
    end

    test "login user can undo emotion to a blog", ~m(community blog user owner_conn)a do
      {:ok, _} = CMS.Articles.emotion(blog, :beer, user)

      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}, emotion: "BEER"}

      article = owner_conn |> gq_mutation(Schema.m(:undo_emotion_article, :blog), variables)

      assert article |> get_in(["emotions", "beerCount"]) == 0
      assert not get_in(article, ["emotions", "viewerHasBeered"])
    end
  end
end
