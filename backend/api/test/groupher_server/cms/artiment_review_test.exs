defmodule GroupherServer.Test.CMS.ArtimentReviewTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{AlertWall, CMS, ReviewBot}
  alias CMS.Review.Requests
  alias GroupherServer.Repo
  alias GroupherServer.ReviewBot

  alias CMS.Model.{
    ArticleLifecycle,
    ArticleReviewBlock,
    ArtimentReview,
    CommentLifecycle,
    CommentReviewBlock
  }

  alias AlertWall.Model.{Item, UserReport}

  alias ReviewBot.Model.ReviewBotConfig

  test "accepts one typed resource reference per request" do
    attrs = %{
      target_type: :article,
      article_id: Ecto.UUID.generate(),
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
    assert Repo.get!(ArtimentReview, first.id).replaced_at
    assert is_nil(Repo.get!(ArtimentReview, first.id).outdated_at)
    assert is_nil(Repo.get!(ArtimentReview, first.id).payload["text"])
    assert is_nil(Repo.get!(ArtimentReview, second.id).replaced_at)
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

  test "replaced review requests stay in history and leave the pending queue" do
    {community, article, _attrs, _user} = mock_article(:post)

    assert {:ok, request} =
             Repo.transact_result(fn ->
               Requests.create_in_transaction(
                 request_attrs(article.id)
                 |> Map.put(:community_id, community.id)
               )
             end)

    request
    |> ArtimentReview.changeset(%{
      state: :completed,
      result: %{"status" => "uncertain"},
      applied_at: DateTime.utc_now(:second),
      replaced_at: DateTime.utc_now(:second)
    })
    |> Repo.update!()

    assert {:ok, []} = Requests.pending_for_scope(%{community_id: community.id})

    assert {:ok, history} =
             Requests.history_for_scope(
               %{type: :article, article_id: article.id, community_id: community.id},
               50,
               0
             )

    assert Enum.any?(history, &(&1.id == request.id))
  end

  test "a Wall write failure rolls back the completed request and CMS block" do
    {_community, article, _attrs, _user} = mock_article(:post)

    assert {:ok, request} =
             Repo.transact_result(fn ->
               Requests.create_in_transaction(request_attrs(article.id))
             end)

    assert {:ok, _claimed} =
             Repo.transact_result(fn -> Requests.claim_in_transaction(request.id) end)

    assert {:error, _reason} =
             CMS.Review.apply_result_internal(request.id, %{
               "status" => "suspect",
               "summary" => "Possible violation",
               "sus_notes" => [
                 %{"type" => "unknown", "evidence" => "x", "explanation" => "invalid type"}
               ]
             })

    assert %ArtimentReview{state: :running, applied_at: nil} =
             Repo.get!(ArtimentReview, request.id)

    refute Repo.get_by(ArticleReviewBlock, artiment_review_id: request.id)
    refute Repo.get_by(Item, target_type: :article, target_id: article.id)
  end

  test "AI clear never removes manual or report-threshold restrictions" do
    {community, article, _attrs, _user} = mock_article(:post)
    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)

    assert {:ok, request} =
             Repo.transact_result(fn ->
               Requests.create_in_transaction(request_attrs(article.id))
             end)

    assert {:ok, :pass} =
             Repo.transact_result(fn ->
               with {:ok, _manual} <-
                      CMS.Review.Restrictions.apply(lifecycle, %{
                        scope_key: "community:#{community.id}",
                        type: :manual_hold,
                        source: :human,
                        source_ref: "test:manual:#{article.id}",
                        operation_ref: Ecto.UUID.generate(),
                        applied_at: DateTime.utc_now(:second)
                      }),
                    {:ok, _threshold} <-
                      CMS.Review.Restrictions.apply(lifecycle, %{
                        scope_key: "community:#{community.id}",
                        type: :report_threshold_hold,
                        source: :domain,
                        source_ref: "report_threshold:item:#{article.id}",
                        operation_ref: Ecto.UUID.generate(),
                        applied_at: DateTime.utc_now(:second)
                      }) do
                 {:ok, :pass}
               end
             end)

    assert {:ok, _claimed} =
             Repo.transact_result(fn -> Requests.claim_in_transaction(request.id) end)

    assert {:ok, _applied} =
             CMS.Review.apply_result_internal(request.id, %{"status" => "clear"})

    assert {:ok, active} =
             Repo.transact_result(fn ->
               CMS.ReviewBlocks.active_for(lifecycle, "community:#{community.id}")
             end)

    assert Enum.any?(active, &(&1.type == :manual_hold))
    assert Enum.any?(active, &(&1.type == :report_threshold_hold))
  end

  test "manual recheck clear preserves every old request-bound hold" do
    {community, article, _attrs, _user} = mock_article(:post)
    assert {:ok, old_request} = create_request(article.id, community.id)
    assert {:ok, :pass} = apply_request_holds(article.id, community.id, old_request.id)
    assert {:ok, new_request} = create_request(article.id, community.id)

    assert Repo.get!(ArtimentReview, old_request.id).replaced_at
    assert is_nil(Repo.get!(ArtimentReview, old_request.id).outdated_at)

    assert {:ok, _claimed} =
             Repo.transact_result(fn -> Requests.claim_in_transaction(new_request.id) end)

    assert {:ok, _applied} =
             CMS.Review.apply_result_internal(new_request.id, %{"status" => "clear"})

    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)

    assert {:ok, active} =
             Repo.transact_result(fn ->
               CMS.ReviewBlocks.active_for(lifecycle, "community:#{community.id}")
             end)

    assert Enum.all?(active, &(&1.artiment_review_id == old_request.id))

    assert Enum.sort(Enum.map(active, & &1.type)) ==
             Enum.sort(CMS.Review.Const.ai_clearable_restriction_types())
  end

  test "content edit clear ends old AI and human waiting holds" do
    {community, article, _attrs, _user} = mock_article(:post)
    assert {:ok, old_request} = create_request(article.id, community.id)
    assert {:ok, :pass} = apply_request_holds(article.id, community.id, old_request.id)
    assert {:ok, new_request} = create_request(article.id, community.id)

    old_request
    |> ArtimentReview.changeset(%{outdated_at: DateTime.utc_now(:second)})
    |> Repo.update!()

    assert {:ok, _claimed} =
             Repo.transact_result(fn -> Requests.claim_in_transaction(new_request.id) end)

    assert {:ok, _applied} =
             CMS.Review.apply_result_internal(new_request.id, %{"status" => "clear"})

    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)

    assert {:ok, active} =
             Repo.transact_result(fn ->
               CMS.ReviewBlocks.active_for(lifecycle, "community:#{community.id}")
             end)

    refute Enum.any?(active, &(&1.artiment_review_id == old_request.id))
  end

  test "Doc recheck preserves replaced holds and content edit clears outdated holds" do
    {_community, doc, _attrs, _author} = mock_article(:doc)
    lifecycle = Repo.get_by!(CMS.Model.DocLifecycle, article_id: doc.id, branch_id: doc.branch_id)

    assert_request_generation_behavior(
      lifecycle,
      "platform",
      %{target_type: :doc, article_id: doc.id, branch_id: doc.branch_id}
    )
  end

  test "Comment recheck preserves replaced holds and content edit clears outdated holds" do
    {community, post, _attrs, author} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_comment("Review comment"),
        author,
        Ecto.UUID.generate()
      )

    lifecycle = Repo.get_by!(CommentLifecycle, comment_id: comment.id)

    assert_request_generation_behavior(
      lifecycle,
      "platform",
      %{target_type: :comment, comment_id: comment.id}
    )
  end

  test "doc-thread Comment recheck preserves replaced holds and content edit clears outdated holds" do
    {community, doc, _attrs, author} = mock_article(:doc)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :doc,
        article_inner_id(doc, community),
        mock_comment("Doc review comment"),
        author,
        Ecto.UUID.generate()
      )

    lifecycle = Repo.get_by!(CommentLifecycle, comment_id: comment.id)

    assert_request_generation_behavior(
      lifecycle,
      "community:#{community.id}",
      %{target_type: :comment, comment_id: comment.id, community_id: community.id}
    )
  end

  test "an uncertain recheck replaces the prior AI opinion on the same item" do
    {_community, article, _attrs, _user} = mock_article(:post)

    assert {:ok, first} =
             Repo.transact_result(fn ->
               Requests.create_in_transaction(request_attrs(article.id))
             end)

    assert {:ok, _claimed} =
             Repo.transact_result(fn -> Requests.claim_in_transaction(first.id) end)

    suspect = %{
      "status" => "suspect",
      "summary" => "Possible advertisement",
      "sus_notes" => [
        %{"type" => "spam", "evidence" => "ad", "explanation" => "Possible promotion"}
      ]
    }

    assert {:ok, _applied} =
             CMS.Review.apply_result_internal(first.id, suspect)

    assert %Item{id: item_id, ai_source_ref: source_ref} =
             Repo.get_by!(Item, target_type: :article, target_id: article.id)

    assert source_ref == first.id
    assert {:ok, :stale} = CMS.Review.apply_result_internal(first.id, suspect)

    assert Repo.aggregate(
             from(block in ArticleReviewBlock, where: block.artiment_review_id == ^first.id),
             :count
           ) == 1

    assert {:ok, second} =
             Repo.transact_result(fn ->
               Requests.create_in_transaction(request_attrs(article.id))
             end)

    assert {:ok, _claimed} =
             Repo.transact_result(fn -> Requests.claim_in_transaction(second.id) end)

    uncertain = %{
      "status" => "uncertain",
      "summary" => "Needs a human decision",
      "sus_notes" => []
    }

    assert {:ok, _applied} =
             CMS.Review.apply_result_internal(second.id, uncertain)

    assert %Item{
             id: ^item_id,
             status: :resolved,
             resolution: "ai_uncertain",
             ai_source_ref: source_ref,
             sus_notes: [],
             summary: summary
           } =
             Repo.get!(Item, item_id)

    assert source_ref == second.id
    assert summary == "Needs a human decision"
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

  test "a new community binding does not replace the system request" do
    {community, article, _attrs, _user} = mock_article(:post)
    assert {:ok, configs} = ReviewBot.configs(community.id, :article)
    target = %{type: :article, article_id: article.id}
    content = %{title: "Title", body: "Body", images: []}

    assert {:ok, [system_request]} =
             Repo.transact_result(fn ->
               CMS.Review.RequestSubmission.register_in_transaction(
                 target,
                 content,
                 configs,
                 :recheck,
                 :system
               )
             end)

    request_count = Repo.aggregate(ArtimentReview, :count, :id)

    assert {:ok, [community_request]} =
             Repo.transact_result(fn ->
               CMS.Review.RequestSubmission.register_in_transaction(
                 target,
                 content,
                 configs,
                 :binding,
                 {:community, community.id}
               )
             end)

    assert community_request.community_id == community.id
    assert is_nil(Repo.get!(ArtimentReview, system_request.id).replaced_at)
    assert Repo.aggregate(ArtimentReview, :count, :id) == request_count + 1
  end

  test "pending queue filters current work in SQL and applies its page window" do
    {_community, article, _attrs, _user} = mock_article(:post)

    assert {:ok, []} = CMS.pending_artiment_reviews(%{community_id: nil})

    request =
      Repo.one!(
        from(request in ArtimentReview,
          where:
            request.article_id == ^article.id and is_nil(request.community_id) and
              is_nil(request.replaced_at)
        )
      )

    request
    |> ArtimentReview.changeset(%{state: :failed, result: %{"error" => "provider_unavailable"}})
    |> Repo.update!()

    assert {:ok, [pending]} = CMS.pending_artiment_reviews(%{community_id: nil}, 1, 0)
    assert pending.id == request.id
    assert {:ok, []} = CMS.pending_artiment_reviews(%{community_id: nil}, 1, 1)
  end

  test "rechecking unchanged content preserves reports; editing marks the old records outdated" do
    {community, article, _attrs, _user} = mock_article(:post)
    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)
    assert {:ok, configs} = ReviewBot.configs(community.id, :article)
    {:ok, reporter} = db_insert(:user)

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
                   details: "Possible advertising"
                 },
                 Ecto.UUID.generate()
               )
             end)

    target = %{type: :article, article_id: article.id, lifecycle: lifecycle}
    content = %{title: "Current title", body: "Current body", images: []}

    assert {:ok, {:ok, [recheck]}} =
             Repo.transaction(fn ->
               CMS.Review.RequestSubmission.register_in_transaction(
                 target,
                 content,
                 configs,
                 :recheck,
                 {:community, community.id}
               )
             end)

    assert is_nil(Repo.get!(UserReport, report.id).outdated_at)
    assert Repo.get!(Item, report.item_id).status == :open
    assert is_nil(recheck.outdated_at)

    recheck
    |> ArtimentReview.changeset(%{
      state: :failed,
      result: %{"code" => "provider_unavailable", "message" => "The check failed."}
    })
    |> Repo.update!()

    assert is_nil(Repo.get!(UserReport, report.id).outdated_at)
    assert Repo.get!(Item, report.item_id).status == :open

    assert {:ok, history} =
             CMS.review_history_for_scope(
               %{type: :article, article_id: article.id, community_id: community.id},
               50,
               0
             )

    assert Enum.any?(history, &(&1.id == recheck.id))
    assert Enum.any?(history, &(&1.id != recheck.id and not is_nil(&1.replaced_at)))
    assert Enum.all?(history, &is_nil(&1.outdated_at))

    assert {:ok, {:ok, _requests}} =
             Repo.transaction(fn ->
               CMS.Review.RequestSubmission.register_in_transaction(
                 target,
                 content,
                 configs,
                 :edit
               )
             end)

    assert Repo.get!(UserReport, report.id).outdated_at
    assert Repo.get!(Item, report.item_id).status == :superseded
    assert Repo.get!(ArtimentReview, recheck.id).outdated_at
  end

  test "removing a community binding resolves its report item without marking content edited" do
    {community, article, _attrs, _user} = mock_article(:post)
    {:ok, reporter} = db_insert(:user)

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
                   details: "Binding report"
                 },
                 Ecto.UUID.generate()
               )
             end)

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn ->
               CMS.Articles.Publish.Target.remove_binding_review(
                 Repo.get!(CMS.Model.Article, article.id),
                 community,
                 Ecto.UUID.generate()
               )
             end)

    assert Repo.get!(Item, report.item_id).status == :resolved
    assert Repo.get!(UserReport, report.id).resolution == "binding_removed"
    assert is_nil(Repo.get!(UserReport, report.id).outdated_at)
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

    assert %ArticleReviewBlock{type: :ai_review_hold, source: :request} =
             Repo.get_by!(ArticleReviewBlock,
               article_id: article.id,
               community_id: community.id,
               artiment_review_id: community_request.id
             )

    assert community_request.policy_snapshot["review_mode"] == "ai_first"
  end

  test "ordinary Comment community policy requests cannot hold the shared Comment globally" do
    {community, article_view, _attrs, author} = mock_article(:post)
    {:ok, destination} = mock_community(author)
    article = Repo.get!(CMS.Model.Article, article_view.article_id)
    assert {:ok, _binding} = CMS.Articles.BindingPersist.mirror(article, destination)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(article_view, community),
        mock_comment("Shared review candidate"),
        author,
        Ecto.UUID.generate()
      )

    {:ok, %{community: config}} = ReviewBot.configs(community.id, :comment)

    config
    |> ReviewBotConfig.changeset(%{review_mode: :ai_first, version: config.version + 1})
    |> Repo.update!()

    assert {:ok, configs} = ReviewBot.configs(community.id, :comment)
    lifecycle = Repo.get_by!(CommentLifecycle, comment_id: comment.id)

    assert {:ok, {:ok, [_system_request, request]}} =
             Repo.transaction(fn ->
               CMS.Review.RequestSubmission.register_in_transaction(
                 %{type: :comment, comment_id: comment.id, lifecycle: lifecycle},
                 %{title: "", body: "Shared review candidate", images: []},
                 configs,
                 :edit
               )
             end)

    {:ok, moderator} = db_insert(:user)

    moderator = %{
      moderator
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"review.decide" => true}}
        }
    }

    assert {:error, _reason} =
             CMS.decide_review_target(
               "comment:#{comment.id}",
               "community:#{community.id}",
               :reject,
               moderator,
               Ecto.UUID.generate()
             )

    refute Repo.exists?(
             from(block in CommentReviewBlock, where: block.artiment_review_id == ^request.id)
           )

    for current <- [community, destination] do
      path = %{
        article: %{
          community: current.slug,
          thread: :post,
          inner_id: article_inner_id(article_view, current)
        },
        inner_id: comment.inner_id
      }

      assert {:ok, _visible} = CMS.FrontDesk.comment(path)
    end

    {:ok, %{community: destination_config}} = ReviewBot.configs(destination.id, :comment)

    destination_config
    |> ReviewBotConfig.changeset(%{
      review_mode: :ai_first,
      version: destination_config.version + 1
    })
    |> Repo.update!()

    assert {:ok, destination_configs} = ReviewBot.configs(destination.id, :comment)

    assert {:ok, {:ok, [destination_request]}} =
             Repo.transaction(fn ->
               CMS.Review.RequestSubmission.register_in_transaction(
                 %{type: :comment, comment_id: comment.id, lifecycle: lifecycle},
                 %{title: "", body: "Shared review candidate", images: []},
                 destination_configs,
                 :recheck,
                 {:community, destination.id}
               )
             end)

    for current_request <- [request, destination_request] do
      assert {:ok, _} =
               Repo.transact_result(fn ->
                 CMS.Review.Requests.claim_in_transaction(current_request.id)
               end)
    end

    assert {:ok, _applied} =
             CMS.Review.apply_result_internal(request.id, %{"status" => "clear"})

    refute Repo.exists?(
             from(block in CommentReviewBlock,
               where: block.artiment_review_id == ^destination_request.id
             )
           )

    assert {:ok, _applied} =
             CMS.Review.apply_result_internal(destination_request.id, %{"status" => "clear"})

    for current <- [community, destination] do
      path = %{
        article: %{
          community: current.slug,
          thread: :post,
          inner_id: article_inner_id(article_view, current)
        },
        inner_id: comment.inner_id
      }

      assert {:ok, _visible} = CMS.FrontDesk.comment(path)
    end
  end

  defp request_attrs(article_id) do
    %{
      target_type: :article,
      article_id: article_id,
      policy_snapshot: %{"review_mode" => "immediate"},
      payload: %{"text" => %{"title" => "title", "body" => "body"}}
    }
  end

  defp create_request(article_id, community_id) do
    attrs = Map.put(request_attrs(article_id), :community_id, community_id)
    Repo.transact_result(fn -> Requests.create_in_transaction(attrs) end)
  end

  defp assert_request_generation_behavior(lifecycle, scope_key, target_attrs) do
    attrs =
      Map.merge(
        %{
          policy_snapshot: %{"review_mode" => "immediate"},
          payload: %{"text" => %{"title" => "title", "body" => "body"}}
        },
        target_attrs
      )

    assert {:ok, old_request} = create_target_request(attrs)
    assert {:ok, :pass} = apply_holds_for_lifecycle(lifecycle, scope_key, old_request.id)
    assert {:ok, manual_recheck} = create_target_request(attrs)
    assert {:ok, _applied} = apply_clear_result(manual_recheck)

    assert {:ok, active_after_recheck} =
             Repo.transact_result(fn -> CMS.ReviewBlocks.active_for(lifecycle, scope_key) end)

    assert Enum.all?(active_after_recheck, &(&1.artiment_review_id == old_request.id))

    old_request
    |> ArtimentReview.changeset(%{outdated_at: DateTime.utc_now(:second)})
    |> Repo.update!()

    assert {:ok, edit_recheck} = create_target_request(attrs)
    assert {:ok, _applied} = apply_clear_result(edit_recheck)

    assert {:ok, active_after_edit} =
             Repo.transact_result(fn -> CMS.ReviewBlocks.active_for(lifecycle, scope_key) end)

    refute Enum.any?(active_after_edit, &(&1.artiment_review_id == old_request.id))
  end

  defp create_target_request(attrs) do
    Repo.transact_result(fn -> Requests.create_in_transaction(attrs) end)
  end

  defp apply_clear_result(request) do
    with {:ok, _claimed} <-
           Repo.transact_result(fn -> Requests.claim_in_transaction(request.id) end) do
      CMS.Review.apply_result_internal(request.id, %{"status" => "clear"})
    end
  end

  defp apply_request_holds(article_id, community_id, request_id) do
    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article_id)

    apply_holds_for_lifecycle(lifecycle, "community:#{community_id}", request_id)
  end

  defp apply_holds_for_lifecycle(lifecycle, scope_key, request_id) do
    Repo.transact_result(fn ->
      Enum.reduce_while(CMS.Review.Const.ai_clearable_restriction_types(), {:ok, :pass}, fn type,
                                                                                            {:ok,
                                                                                             :pass} ->
        case CMS.Review.Restrictions.apply(lifecycle, %{
               scope_key: scope_key,
               type: type,
               source: :request,
               artiment_review_id: request_id,
               source_ref: "request:#{request_id}:#{type}",
               operation_ref: Ecto.UUID.generate(),
               applied_at: DateTime.utc_now(:second)
             }) do
          {:ok, _restriction} -> {:cont, {:ok, :pass}}
          {:error, _reason} = error -> {:halt, error}
        end
      end)
    end)
  end
end
