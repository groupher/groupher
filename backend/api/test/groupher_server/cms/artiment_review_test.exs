defmodule GroupherServer.Test.CMS.ArtimentReviewTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, ReviewBot}
  alias CMS.Review.Requests
  alias GroupherServer.Repo
  alias GroupherServer.ReviewBot

  alias CMS.Model.{
    ArticleLifecycle,
    ArticleReviewBlock,
    ArtimentReview
  }

  alias ReviewBot.Model.ReviewBotConfig

  test "accepts one typed resource reference per request" do
    attrs = %{
      target_type: :article,
      article_id: Ecto.UUID.generate(),
      subject_ref: Ecto.UUID.generate(),
      policy_snapshot: %{"review_mode" => "immediate"},
      payload: %{"text" => %{"title" => "title", "body" => "body"}},
      payload_expires_at: DateTime.add(DateTime.utc_now(), 3_600, :second)
    }

    assert ArtimentReview.changeset(%ArtimentReview{}, attrs).valid?

    refute ArtimentReview.changeset(
             %ArtimentReview{},
             Map.merge(attrs, %{target_type: :comment, comment_id: 12})
           ).valid?
  end

  test "a newer request supersedes the previous request in the same scope" do
    {_community, article, _attrs, _user} = mock_article(:post)

    assert {:ok, {:ok, first}} =
             Repo.transaction(fn ->
               Requests.create_in_transaction(request_attrs(article.id))
             end)

    assert {:ok, {:ok, second}} =
             Repo.transaction(fn ->
               Requests.create_in_transaction(request_attrs(article.id))
             end)

    assert first.id != second.id
    assert Repo.get!(ArtimentReview, first.id).outdated_at
    assert is_nil(Repo.get!(ArtimentReview, first.id).payload["text"])
    assert is_nil(Repo.get!(ArtimentReview, second.id).outdated_at)
    assert {:ok, current} = Requests.current(second.id)
    assert current.id == second.id
    assert {:error, _reason} = Requests.current(first.id)
  end

  test "completed opinion can only be applied for the current request" do
    {_community, article, _attrs, _user} = mock_article(:post)

    assert {:ok, {:ok, applied}} =
             Repo.transaction(fn ->
               {:ok, request} =
                 Requests.create_in_transaction(request_attrs(article.id))

               {:ok, request} = Requests.claim_in_transaction(request.id)

               {:ok, completed} =
                 Requests.complete_in_transaction(request.id, %{"status" => "clear"})

               Requests.mark_applied_in_transaction(completed.id)
             end)

    assert applied.state == :completed
    assert applied.applied_at
    assert applied.payload == %{}
  end

  test "registration pins independent system and community policies" do
    {community, article, _attrs, _user} = mock_article(:post)
    assert {:ok, configs} = ReviewBot.configs(community.id, :article)

    target = %{
      type: :article,
      article_id: article.id
    }

    content = %{title: "Title", body: "Body", images: []}

    assert {:ok, {:ok, [system_request, community_request]}} =
             Repo.transaction(fn ->
               GroupherServer.CMS.register_artiment_reviews_in_transaction(
                 target,
                 content,
                 configs,
                 :publish
               )
             end)

    assert system_request.community_id == nil
    assert community_request.community_id == community.id
    assert system_request.policy_snapshot["scope"] == "system"
    assert community_request.policy_snapshot["scope"] == "community:#{community.id}"

    assert system_request.policy_snapshot["system_config_id"] ==
             community_request.policy_snapshot["system_config_id"]

    assert system_request.payload["text"]["title"] == "Title"
    assert system_request.payload["images"] == []
  end

  test "non-immediate community policy creates an initial CMS hold" do
    {community, article, _attrs, _user} = mock_article(:post)
    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)

    {:ok, %{community: community_config}} = ReviewBot.configs(community.id, :article)

    community_config
    |> ReviewBotConfig.changeset(%{
      review_mode: :ai_first,
      version: community_config.version + 1
    })
    |> Repo.update!()

    assert {:ok, configs} = ReviewBot.configs(community.id, :article)

    assert {:ok, {:ok, [_system_request, community_request]}} =
             Repo.transaction(fn ->
               GroupherServer.CMS.register_artiment_reviews_in_transaction(
                 %{
                   type: :article,
                   article_id: article.id,
                   lifecycle: lifecycle
                 },
                 %{title: "Title", body: "Body", images: []},
                 configs,
                 :edit
               )
             end)

    assert %ArticleReviewBlock{type: :awaiting_ai, source: :request} =
             Repo.get_by!(ArticleReviewBlock,
               article_id: article.id,
               community_id: community.id,
               artiment_review_id: community_request.id
             )

    assert community_request.policy_snapshot["review_mode"] == "ai_first"
  end

  defp request_attrs(article_id) do
    %{
      target_type: :article,
      article_id: article_id,
      subject_ref: Ecto.UUID.generate(),
      policy_snapshot: %{"review_mode" => "immediate"},
      payload: %{"text" => %{"title" => "title", "body" => "body"}}
    }
  end
end
