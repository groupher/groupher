defmodule GroupherServer.Test.Mutation.Articles.ChangelogEmotion do
  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community changelog_attrs)a}
  end

  describe "[changelog emotion]" do
    @emotion_query """
    mutation($id: ID!, $emotion: ArticleEmotion!) {
      emotionToChangelog(id: $id, emotion: $emotion) {
        id
        emotions {
          beerCount
          viewerHasBeered
          latestBeerUsers {
            login
            nickname
          }
        }
      }
    }
    """

    test "login user can emotion to a changelog", ~m(community changelog_attrs user user_conn)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      variables = %{id: changelog.id, emotion: "BEER"}
      article = user_conn |> mutation_result(@emotion_query, variables, "emotionToChangelog")

      assert article |> get_in(["emotions", "beerCount"]) == 1
      assert get_in(article, ["emotions", "viewerHasBeered"])
    end

    @emotion_query """
    mutation($id: ID!, $emotion: ArticleEmotion!) {
      undoEmotionToChangelog(id: $id, emotion: $emotion) {
        id
        emotions {
          beerCount
          viewerHasBeered
          latestBeerUsers {
            login
            nickname
          }
        }
      }
    }
    """

    test "login user can undo emotion to a changelog",
         ~m(community changelog_attrs user owner_conn)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, _} = CMS.emotion_to_article(:changelog, changelog.id, :beer, user)

      variables = %{id: changelog.id, emotion: "BEER"}
      article = owner_conn |> mutation_result(@emotion_query, variables, "undoEmotionToChangelog")

      assert article |> get_in(["emotions", "beerCount"]) == 0
      assert not get_in(article, ["emotions", "viewerHasBeered"])
    end
  end
end
