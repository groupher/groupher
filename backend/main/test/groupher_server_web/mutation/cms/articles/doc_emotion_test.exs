defmodule GroupherServer.Test.Mutation.Articles.DocEmotion do
  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    doc_attrs = mock_attrs(:doc, %{community_id: community.id})

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community doc_attrs)a}
  end

  describe "[doc emotion]" do
    @emotion_query """
    mutation($id: ID!, $emotion: ArticleEmotion!) {
      emotionToDoc(id: $id, emotion: $emotion) {
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

    test "login user can emotion to a doc", ~m(community doc_attrs user user_conn)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      variables = %{id: doc.id, emotion: "BEER"}
      article = user_conn |> mutation_result(@emotion_query, variables, "emotionToDoc")

      assert article |> get_in(["emotions", "beerCount"]) == 1
      assert get_in(article, ["emotions", "viewerHasBeered"])
    end

    @emotion_query """
    mutation($id: ID!, $emotion: ArticleEmotion!) {
      undoEmotionToDoc(id: $id, emotion: $emotion) {
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

    test "login user can undo emotion to a doc",
         ~m(community doc_attrs user owner_conn)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, _} = CMS.emotion_to_article(:doc, doc.id, :beer, user)

      variables = %{id: doc.id, emotion: "BEER"}
      article = owner_conn |> mutation_result(@emotion_query, variables, "undoEmotionToDoc")

      assert article |> get_in(["emotions", "beerCount"]) == 0
      assert not get_in(article, ["emotions", "viewerHasBeered"])
    end
  end
end
