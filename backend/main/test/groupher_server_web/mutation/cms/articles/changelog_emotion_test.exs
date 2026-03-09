defmodule GroupherServer.Test.Mutation.Articles.ChangelogEmotion do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community changelog)a}
  end

  describe "[changelog emotion]" do
    test "login user can emotion to a changelog", ~m(community changelog user_conn)a do
      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug}, emotion: "BEER"}

      article = user_conn |> gq_mutation(Schema.m(:emotion_article, :changelog), variables)

      assert article |> get_in(["emotions", "beerCount"]) == 1
      assert get_in(article, ["emotions", "viewerHasBeered"])
    end

    test "login user can undo emotion to a changelog", ~m(community changelog user owner_conn)a do
      {:ok, _} = CMS.Articles.emotion(changelog, :beer, user)

      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug}, emotion: "BEER"}

      article =
        owner_conn |> gq_mutation(Schema.m(:undo_emotion_article, :changelog), variables)

      assert article |> get_in(["emotions", "beerCount"]) == 0
      assert not get_in(article, ["emotions", "viewerHasBeered"])
    end
  end
end
