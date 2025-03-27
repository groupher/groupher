defmodule GroupherServer.Test.Mutation.Articles.ChangelogEmotion do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community changelog)a}
  end

  describe "[changelog emotion]" do
    @tag :wip
    test "login user can emotion to a changelog", ~m(community changelog user_conn)a do
      variables = %{id: changelog.inner_id, community: community.slug, emotion: "BEER"}

      article =
        user_conn
        |> mutation_result(
          Schema.m(:emotion_article, :changelog),
          variables,
          "emotionToChangelog"
        )

      assert article |> get_in(["emotions", "beerCount"]) == 1
      assert get_in(article, ["emotions", "viewerHasBeered"])
    end

    @tag :wip
    test "login user can undo emotion to a changelog", ~m(community changelog user owner_conn)a do
      {:ok, _} = CMS.emotion_to_article(changelog, :beer, user)

      variables = %{id: changelog.inner_id, community: community.slug, emotion: "BEER"}

      article =
        owner_conn
        |> mutation_result(
          Schema.m(:undo_emotion_article, :changelog),
          variables,
          "undoEmotionToChangelog"
        )

      assert article |> get_in(["emotions", "beerCount"]) == 0
      assert not get_in(article, ["emotions", "viewerHasBeered"])
    end
  end
end
