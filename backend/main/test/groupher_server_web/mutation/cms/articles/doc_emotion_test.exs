defmodule GroupherServer.Test.Mutation.Articles.DocEmotion do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, doc, _, user} = mock_article(:doc)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community doc)a}
  end

  describe "[doc emotion]" do
    @tag :wip
    test "login user can emotion to a doc", ~m(community doc user_conn)a do
      variables = %{id: doc.inner_id, community: community.slug, emotion: "BEER"}

      article =
        user_conn
        |> mutation_result(
          Schema.m(:emotion_article, :doc),
          variables,
          "emotionToDoc"
        )

      assert article |> get_in(["emotions", "beerCount"]) == 1
      assert get_in(article, ["emotions", "viewerHasBeered"])
    end

    @tag :wip
    test "login user can undo emotion to a doc", ~m(community doc user owner_conn)a do
      {:ok, _} = CMS.emotion_to_article(doc, :beer, user)

      variables = %{id: doc.inner_id, community: community.slug, emotion: "BEER"}

      article =
        owner_conn
        |> mutation_result(
          Schema.m(:undo_emotion_article, :doc),
          variables,
          "undoEmotionToDoc"
        )

      assert article |> get_in(["emotions", "beerCount"]) == 0
      assert not get_in(article, ["emotions", "viewerHasBeered"])
    end
  end
end
