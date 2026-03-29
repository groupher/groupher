defmodule GroupherServer.Test.Mutation.Articles.ChangelogEmotion do
  @moduledoc false

  use GroupherServer.TestMate

  defp emotion_entry(emotions, type) do
    Enum.find(emotions || [], &(&1["type"] == String.upcase(to_string(type))))
  end

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

      assert emotion_entry(article["emotions"], :beer)["count"] == 1
      assert emotion_entry(article["emotions"], :beer)["viewerHasReacted"]
    end

    test "login user can undo emotion to a changelog", ~m(community changelog user owner_conn)a do
      {:ok, _} = CMS.Articles.emotion(changelog, :beer, user)

      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug}, emotion: "BEER"}

      article =
        owner_conn |> gq_mutation(Schema.m(:undo_emotion_article, :changelog), variables)

      assert is_nil(emotion_entry(article["emotions"], :beer))
    end
  end
end
