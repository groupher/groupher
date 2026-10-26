defmodule GroupherServer.Test.CMS.ReviewDecisionTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{AlertWall, CMS, Repo, ReviewBot}
  alias CMS.Model.{ArticleReviewBlock, ArtimentReview}
  alias AlertWall.Model.{Item, UserReport}
  alias ReviewBot.Model.ReviewBotConfig

  test "human deny and release run as receipt-backed CMS decisions" do
    {community, article, _attrs, _author} = mock_article(:post)
    {:ok, reviewer} = db_insert(:user)

    reviewer = %{
      reviewer
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"review.decide" => true}}
        }
    }

    target_key = "article:#{article.id}"
    scope_key = "community:#{community.id}"

    assert {:error, _reason} =
             CMS.decide_review_target(
               target_key,
               scope_key,
               :approve,
               reviewer,
               Ecto.UUID.generate()
             )

    Repo.update_all(
      from(request in ArtimentReview,
        where:
          request.article_id == ^article.id and request.community_id == ^community.id and
            is_nil(request.outdated_at)
      ),
      set: [state: :failed]
    )

    assert {:error, _reason} =
             CMS.decide_review_target(
               target_key,
               scope_key,
               :approve,
               reviewer,
               Ecto.UUID.generate()
             )

    Repo.update_all(
      from(request in ArtimentReview,
        where:
          request.article_id == ^article.id and request.community_id == ^community.id and
            is_nil(request.outdated_at)
      ),
      set: [state: :queued]
    )

    assert {:ok, _result} =
             CMS.decide_review_target(
               target_key,
               scope_key,
               :deny,
               reviewer,
               Ecto.UUID.generate()
             )

    assert %ArticleReviewBlock{type: :manual_hold, source: :human} =
             Repo.one!(
               from(restriction in ArticleReviewBlock,
                 where:
                   restriction.article_id == ^article.id and
                     restriction.community_id == ^community.id and
                     restriction.source == :human and is_nil(restriction.resolved_at)
               )
             )

    assert {:ok, _result} =
             CMS.decide_review_target(
               target_key,
               scope_key,
               :release,
               reviewer,
               Ecto.UUID.generate()
             )

    assert Repo.aggregate(
             from(restriction in ArticleReviewBlock,
               where:
                 restriction.article_id == ^article.id and
                   restriction.community_id == ^community.id and restriction.source == :human and
                   is_nil(restriction.resolved_at)
             ),
             :count
           ) == 0
  end

  test "a CMS decision resolves a report-only Wall item in its own scope" do
    {community, article, _attrs, _author} = mock_article(:post)
    {:ok, reporter} = db_insert(:user)
    {:ok, reviewer} = db_insert(:user)

    reviewer = %{
      reviewer
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"review.decide" => true}}
        }
    }

    assert {:ok, {:ok, report}} =
             Repo.transaction(fn ->
               AlertWall.submit_report_in_transaction(
                 %{
                   reporter_id: reporter.id,
                   owner: :cms,
                   target_type: :article,
                   target_id: article.id,
                   observed_version: 1,
                   community_id: community.id,
                   report_type: "SPAM",
                   details: "Please review"
                 },
                 Ecto.UUID.generate()
               )
             end)

    assert %Item{ai_source_ref: nil, status: :open} = Repo.get!(Item, report.item_id)

    assert {:ok, _result} =
             CMS.decide_review_target(
               "article:#{article.id}",
               "community:#{community.id}",
               :deny,
               reviewer,
               Ecto.UUID.generate()
             )

    assert Repo.get!(Item, report.item_id).status == :resolved
    assert Repo.get!(UserReport, report.id).resolved_at
  end

  test "recheck registers a new current request through the CMS Receipt command" do
    {community, article, _attrs, _author} = mock_article(:post)
    {:ok, reviewer} = db_insert(:user)

    reviewer = %{
      reviewer
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"review.decide" => true}}
        }
    }

    before_ids =
      Repo.all(
        from(request in ArtimentReview,
          where: request.article_id == ^article.id,
          select: request.id
        )
      )

    assert {:ok, result} =
             CMS.recheck_review_target(
               "article:#{article.id}",
               "community:#{community.id}",
               reviewer,
               Ecto.UUID.generate()
             )

    assert result.action == "recheck"
    assert result.target_type == :article
    assert result.target_id == article.id
    assert result.request_count == 1

    requests =
      Repo.all(
        from(request in ArtimentReview,
          where: request.article_id == ^article.id and request.id not in ^before_ids
        )
      )

    assert [%ArtimentReview{community_id: community_id}] = requests
    assert community_id == community.id
  end

  test "platform Comment recheck registers only the platform policy request" do
    {community, article, _attrs, author} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(article, community),
        mock_comment("public comment"),
        author,
        Ecto.UUID.generate()
      )

    {:ok, reviewer} = db_insert(:user)
    reviewer = %{reviewer | cur_passport: %{"global" => %{"review.platform.decide" => true}}}

    before_ids =
      Repo.all(
        from(request in ArtimentReview,
          where: request.comment_id == ^comment.id,
          select: request.id
        )
      )

    assert {:ok, result} =
             CMS.recheck_review_target(
               "comment:#{comment.id}",
               "platform",
               reviewer,
               Ecto.UUID.generate()
             )

    assert result.request_count == 1

    requests =
      Repo.all(
        from(request in ArtimentReview,
          where: request.comment_id == ^comment.id and request.id not in ^before_ids
        )
      )

    assert [%ArtimentReview{community_id: nil}] = requests
  end

  test "platform Comment recheck does not require a community policy" do
    {community, article, _attrs, author} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(article, community),
        mock_comment("public comment"),
        author,
        Ecto.UUID.generate()
      )

    Repo.delete!(
      Repo.get_by!(ReviewBotConfig,
        community_id: community.id,
        subject_type: :comment
      )
    )

    {:ok, reviewer} = db_insert(:user)
    reviewer = %{reviewer | cur_passport: %{"global" => %{"review.platform.decide" => true}}}

    assert {:ok, result} =
             CMS.recheck_review_target(
               "comment:#{comment.id}",
               "platform",
               reviewer,
               Ecto.UUID.generate()
             )

    assert result.request_count == 1
  end
end
