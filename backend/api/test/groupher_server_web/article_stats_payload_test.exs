defmodule GroupherServerWeb.Resolvers.ArticleStatsPayloadTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ErrorCat, as: CmsErrorCat
  alias GroupherServerWeb.Resolvers.{ArticleInteractionPayload, ArticleStatsPayload}

  test "presents the requested article stats with its public locator" do
    article = %{id: 7, inner_id: 42}
    stats = %{{:post, 7} => %{views: 3}}

    assert {:ok,
            %{
              community: "home",
              thread: :post,
              inner_id: 42,
              views: 3
            }} = ArticleStatsPayload.from_map(stats, :post, article, "home")
  end

  test "returns a domain error when the requested projection row is missing" do
    article = %{id: 7, inner_id: 42}

    assert ArticleStatsPayload.from_map(%{}, :post, article, "home") ==
             {:error, CmsErrorCat.command_result_unavailable()}
  end

  test "preserves independently read public and private interaction revisions" do
    article = %{id: 7, inner_id: 42}

    assert {:ok, %{interaction_revision: 21}} =
             ArticleStatsPayload.from_map(
               %{{:post, 7} => %{interaction_revision: 21}},
               :post,
               article,
               "home"
             )

    assert %{
             interaction_revision: 20,
             viewer_has_upvoted: true
           } =
             ArticleInteractionPayload.from(
               %{community: "home", thread: :post, inner_id: 42},
               %{
                 interaction_revision: 20,
                 viewer_has_upvoted: true,
                 viewer_has_collected: false,
                 viewer_emotion: nil
               }
             )
  end
end
