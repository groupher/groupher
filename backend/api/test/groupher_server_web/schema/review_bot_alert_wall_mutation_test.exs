defmodule GroupherServer.TestWeb.Schema.ReviewBotAlertWallMutationTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer
  alias GroupherServer.{AlertWall, Repo}
  alias AlertWall.Model.Item
  alias GroupherServerWeb.Schema

  test "review mutations expose only the V2 action contract" do
    fields = Schema.__absinthe_type__(:cms_review_mutations).fields

    assert Map.has_key?(fields, :recheck_article_v2)
    assert Map.has_key?(fields, :recheck_comment_v2)
    assert Map.has_key?(fields, :recheck_doc_v2)
    assert Map.has_key?(fields, :approve_article_v2)
    assert Map.has_key?(fields, :reject_article_v2)
    refute Map.has_key?(fields, :deny_article)
    refute Map.has_key?(fields, :release_article)
    refute Map.has_key?(fields, :approve_article)
    refute Map.has_key?(fields, :reject_article)
    refute Map.has_key?(fields, :recheck_article)
    refute Map.has_key?(fields, :recheck_doc)
    refute Map.has_key?(fields, :recheck_comment)
    refute Map.has_key?(fields, :approve_comment)
    refute Map.has_key?(fields, :reject_comment)
    refute Map.has_key?(fields, :deny_comment)
    refute Map.has_key?(fields, :release_comment)
    refute Map.has_key?(fields, :approve_doc)
    refute Map.has_key?(fields, :reject_doc)
    refute Map.has_key?(fields, :deny_doc)
    refute Map.has_key?(fields, :release_doc)

    assert Enum.sort(Schema.__absinthe_type__(:review_action).values |> Map.keys()) ==
             [:approve, :recheck, :reject]
  end

  test "recheckArticleV2 succeeds through GraphQL" do
    {community, post, _attrs, reviewer} = mock_article(:post)
    reviewer = put_community_permission(reviewer, community.slug, "review.decide")

    mutation = """
    mutation Recheck($target: CmsReviewTargetInput!, $scope: ReviewBotScopeInput!, $commandId: ID!) {
      recheckArticleV2(target: $target, scope: $scope, commandId: $commandId) {
        commandId
        targetType
        targetId
        action
      }
    }
    """

    assert {:ok, %{data: %{"recheckArticleV2" => result}}} =
             Absinthe.run(mutation, Schema,
               variables: %{
                 "target" => %{
                   "type" => "ARTICLE",
                   "articleId" => post.id,
                   "communityId" => community.id
                 },
                 "scope" => %{"type" => "COMMUNITY", "community" => community.slug},
                 "commandId" => Ecto.UUID.generate()
               },
               context: %{cur_user: reviewer}
             )

    assert result["action"] == "RECHECK"
    assert result["targetType"] == "ARTICLE"
    assert result["targetId"] == to_string(post.id)
  end

  test "recheckCommentV2 succeeds through GraphQL" do
    {community, post, _attrs, author} = mock_article(:post)

    {:ok, comment} =
      GroupherServer.CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_comment("public comment"),
        author,
        Ecto.UUID.generate()
      )

    {:ok, reviewer} = db_insert(:user)
    reviewer = %{reviewer | cur_passport: %{"global" => %{"review.platform.decide" => true}}}

    mutation = """
    mutation Recheck($target: CmsReviewTargetInput!, $scope: ReviewBotScopeInput!, $commandId: ID!) {
      recheckCommentV2(target: $target, scope: $scope, commandId: $commandId) {
        commandId
        targetType
        targetId
        action
      }
    }
    """

    assert {:ok, %{data: %{"recheckCommentV2" => result}}} =
             Absinthe.run(mutation, Schema,
               variables: %{
                 "target" => %{
                   "type" => "COMMENT",
                   "commentId" => comment.id
                 },
                 "scope" => %{"type" => "PLATFORM"},
                 "commandId" => Ecto.UUID.generate()
               },
               context: %{cur_user: reviewer}
             )

    assert result["action"] == "RECHECK"
    assert result["targetType"] == "COMMENT"
    assert result["targetId"] == to_string(comment.id)
  end

  test "recheckDocV2 succeeds through GraphQL" do
    {_community, doc, _attrs, _author} = mock_article(:doc)
    {:ok, reviewer} = db_insert(:user)
    reviewer = %{reviewer | cur_passport: %{"global" => %{"review.platform.decide" => true}}}

    mutation = """
    mutation Recheck($target: CmsReviewTargetInput!, $scope: ReviewBotScopeInput!, $commandId: ID!) {
      recheckDocV2(target: $target, scope: $scope, commandId: $commandId) {
        commandId
        targetType
        targetId
        action
      }
    }
    """

    assert {:ok, %{data: %{"recheckDocV2" => result}}} =
             Absinthe.run(mutation, Schema,
               variables: %{
                 "target" => %{
                   "type" => "DOC",
                   "articleId" => doc.id,
                   "branchId" => doc.branch_id
                 },
                 "scope" => %{"type" => "PLATFORM"},
                 "commandId" => Ecto.UUID.generate()
               },
               context: %{cur_user: reviewer}
             )

    assert result["action"] == "RECHECK"
    assert result["targetType"] == "DOC"
    assert result["targetId"] == "#{doc.id}:#{doc.branch_id}"
  end

  test "approve and reject serialize through the ReviewAction enum" do
    {community, post, _attrs, _author} = mock_article(:post)
    {:ok, reviewer} = db_insert(:user)
    reviewer = put_community_permission(reviewer, community.slug, "review.decide")

    variables = %{
      "target" => %{
        "type" => "ARTICLE",
        "articleId" => post.id,
        "communityId" => community.id
      },
      "commandId" => Ecto.UUID.generate()
    }

    reject = """
    mutation Decide($target: CmsReviewTargetInput!, $commandId: ID!) {
      rejectArticleV2(target: $target, commandId: $commandId) { action }
    }
    """

    assert {:ok, %{data: %{"rejectArticleV2" => %{"action" => "REJECT"}}}} =
             Absinthe.run(reject, Schema, variables: variables, context: %{cur_user: reviewer})

    approve = """
    mutation Decide($target: CmsReviewTargetInput!, $commandId: ID!) {
      approveArticleV2(target: $target, commandId: $commandId) { action }
    }
    """

    variables = Map.put(variables, "commandId", Ecto.UUID.generate())

    assert {:ok, %{data: %{"approveArticleV2" => %{"action" => "APPROVE"}}}} =
             Absinthe.run(approve, Schema, variables: variables, context: %{cur_user: reviewer})
  end

  test "submitReport succeeds through GraphQL" do
    {community, post, _attrs, reporter} = mock_article(:post)

    mutation = """
    mutation Submit($input: AlertReportInput!, $commandId: ID!) {
      submitReport(input: $input, commandId: $commandId) {
        id
        reportType
      }
    }
    """

    assert {:ok, %{data: %{"submitReport" => report}}} =
             Absinthe.run(mutation, Schema,
               variables: %{
                 "input" => %{
                   "target" => %{
                     "type" => "ARTICLE",
                     "observedVersion" => 1,
                     "article" => %{
                       "community" => community.slug,
                       "thread" => "POST",
                       "innerId" => Integer.to_string(article_inner_id(post, community))
                     }
                   },
                   "reportType" => "SPAM",
                   "details" => "Please review this post"
                 },
                 "commandId" => Ecto.UUID.generate()
               },
               context: %{cur_user: reporter}
             )

    assert report["id"]
    assert report["reportType"] == "SPAM"
  end

  test "an author sees only a safe review notice" do
    {community, post, _attrs, author} = mock_article(:post)
    {:ok, other_reader} = db_insert(:user)

    query = """
    query Notice($target: CmsReviewTargetInput!) {
      contentReviewNotice(target: $target) { status failureCode }
    }
    """

    variables = %{
      "target" => %{
        "type" => "ARTICLE",
        "article" => %{
          "community" => community.slug,
          "thread" => "POST",
          "innerId" => Integer.to_string(article_inner_id(post, community))
        }
      }
    }

    assert {:ok, %{data: %{"contentReviewNotice" => notice}}} =
             Absinthe.run(query, Schema, variables: variables, context: %{cur_user: author})

    assert Map.keys(notice) |> Enum.sort() == ["failureCode", "status"]

    assert {:ok, %{data: %{"contentReviewNotice" => nil}, errors: [_ | _]}} =
             Absinthe.run(query, Schema, variables: variables, context: %{cur_user: other_reader})
  end

  test "a report threshold hold appears as waiting_human in the author notice" do
    {community, post, _attrs, author} = mock_article(:post)

    Enum.each(1..3, fn _ ->
      {:ok, reporter} = db_insert(:user)

      assert {:ok, _report} =
               GroupherServer.AlertWall.Commands.SubmitReport.execute(
                 %{
                   owner: :cms,
                   target_type: :article,
                   target_id: post.id,
                   community_id: community.id,
                   observed_version: 1
                 },
                 :spam,
                 "Please review this post",
                 reporter,
                 Ecto.UUID.generate()
               )
    end)

    query = """
    query Notice($target: CmsReviewTargetInput!) {
      contentReviewNotice(target: $target) { status failureCode }
    }
    """

    variables = %{
      "target" => %{
        "type" => "ARTICLE",
        "article" => %{
          "community" => community.slug,
          "thread" => "POST",
          "innerId" => Integer.to_string(article_inner_id(post, community))
        }
      }
    }

    assert {:ok, %{data: %{"contentReviewNotice" => %{"status" => "waiting_human"}}}} =
             Absinthe.run(query, Schema, variables: variables, context: %{cur_user: author})
  end

  test "contentReviewHistory exposes a failed check for manual recheck" do
    {_community, post, _attrs, reviewer} = mock_article(:post)
    reviewer = %{reviewer | cur_passport: %{"global" => %{"review.platform.read" => true}}}

    request =
      Repo.one!(
        from(request in GroupherServer.CMS.Model.ArtimentReview,
          where: request.article_id == ^post.id and is_nil(request.community_id)
        )
      )

    request
    |> GroupherServer.CMS.Model.ArtimentReview.changeset(%{
      state: :failed,
      result: %{"code" => "provider_unavailable", "message" => "The check failed."}
    })
    |> Repo.update!()

    query = """
    query History($target: CmsReviewTargetInput!) {
      contentReviewHistory(target: $target) {
        artimentReviewId
        state
        failureCode
        failureMessage
        outdatedAt
      }
    }
    """

    assert {:ok, %{data: %{"contentReviewHistory" => [entry | _]}}} =
             Absinthe.run(query, Schema,
               variables: %{"target" => %{"type" => "ARTICLE", "articleId" => post.id}},
               context: %{cur_user: reviewer}
             )

    assert entry["artimentReviewId"] == request.id
    assert entry["state"] == "failed"
    assert entry["failureCode"] == "provider_unavailable"
    assert entry["failureMessage"] == "The check failed."
    assert is_nil(entry["outdatedAt"])
  end

  test "platform Comment history stays in the platform scope" do
    {community, post, _attrs, author} = mock_article(:post)

    {:ok, comment} =
      GroupherServer.CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_comment("public comment"),
        author,
        Ecto.UUID.generate()
      )

    {:ok, reviewer} = db_insert(:user)
    reviewer = %{reviewer | cur_passport: %{"global" => %{"review.platform.read" => true}}}

    query = """
    query History($target: CmsReviewTargetInput!) {
      contentReviewHistory(target: $target) { artimentReviewId communityId }
    }
    """

    assert {:ok, %{data: %{"contentReviewHistory" => [entry | _]}}} =
             Absinthe.run(query, Schema,
               variables: %{
                 "target" => %{
                   "type" => "COMMENT",
                   "commentId" => to_string(comment.id),
                   "communityId" => nil
                 }
               },
               context: %{cur_user: reviewer}
             )

    assert is_nil(entry["communityId"])
  end

  test "submitReport resolves a user by public login" do
    {:ok, reporter} = db_insert(:user)
    {:ok, target} = db_insert(:user)

    mutation = """
    mutation Submit($input: AlertReportInput!, $commandId: ID!) {
      submitReport(input: $input, commandId: $commandId) {
        id
        targetType
        targetId
      }
    }
    """

    assert {:ok, %{data: %{"submitReport" => report}}} =
             Absinthe.run(mutation, Schema,
               variables: %{
                 "input" => %{
                   "target" => %{"type" => "USER", "userLogin" => target.login},
                   "reportType" => "IMPERSONATION"
                 },
                 "commandId" => Ecto.UUID.generate()
               },
               context: %{cur_user: reporter}
             )

    assert report["targetType"] == "USER"
    assert report["targetId"] == target.login
  end

  test "updateReviewBotConfig succeeds through GraphQL" do
    {:ok, community} = db_insert(:community)
    {:ok, user} = db_insert(:user)

    reviewer = %{
      user
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"review.configure" => true}}
        }
    }

    mutation = """
    mutation Update($input: UpdateReviewBotConfigInput!, $commandId: ID!) {
      updateReviewBotConfig(input: $input, commandId: $commandId) {
        id
        reviewMode
        reviewBanWords
        reviewPrompt
        version
      }
    }
    """

    assert {:ok, %{data: %{"updateReviewBotConfig" => config}}} =
             Absinthe.run(mutation, Schema,
               variables: %{
                 "input" => %{
                   "scope" => %{"type" => "COMMUNITY", "community" => community.slug},
                   "subjectType" => "ARTICLE",
                   "expectedVersion" => 1,
                   "reviewMode" => "HUMAN_FIRST",
                   "reviewBanWords" => ["coupon"],
                   "reviewPrompt" => "Evaluate the full context."
                 },
                 "commandId" => Ecto.UUID.generate()
               },
               context: %{cur_user: reviewer}
             )

    assert config["reviewMode"] == "HUMAN_FIRST"
    assert config["reviewBanWords"] == ["coupon"]
    assert config["version"] == 2
  end

  test "resolveAlertItem succeeds through GraphQL" do
    {:ok, reviewer} = db_insert(:user)
    reviewer = %{reviewer | cur_passport: %{"global" => %{"review.platform.decide" => true}}}

    assert {:ok, {:ok, item}} =
             Repo.transaction(fn ->
               AlertWall.add_in_transaction(
                 %{
                   owner: :cms,
                   target_type: :article,
                   target_id: "graphql-resolve",
                   community_id: nil,
                   ai_source_ref: nil,
                   sus_notes: [],
                   summary: "needs review"
                 },
                 Ecto.UUID.generate()
               )
             end)

    mutation = """
    mutation Resolve($id: ID!, $resolution: String!, $expectedVersion: Int!, $commandId: ID!) {
      resolveAlertItem(
        id: $id
        resolution: $resolution
        expectedVersion: $expectedVersion
        commandId: $commandId
      ) {
        itemId
        resolution
      }
    }
    """

    assert {:ok, %{data: %{"resolveAlertItem" => result}}} =
             Absinthe.run(mutation, Schema,
               variables: %{
                 "id" => to_string(item.id),
                 "resolution" => "reviewed",
                 "expectedVersion" => item.version,
                 "commandId" => Ecto.UUID.generate()
               },
               context: %{cur_user: reviewer}
             )

    assert result == %{"itemId" => to_string(item.id), "resolution" => "reviewed"}
    assert Repo.get!(Item, item.id).status == :resolved
  end

  test "alertItems closed filter returns earlier items through GraphQL" do
    {:ok, reviewer} = db_insert(:user)
    reviewer = %{reviewer | cur_passport: %{"global" => %{"review.platform.read" => true}}}

    assert {:ok, {:ok, item}} =
             Repo.transaction(fn ->
               AlertWall.add_in_transaction(
                 %{
                   owner: :cms,
                   target_type: :article,
                   target_id: "graphql-history",
                   community_id: nil,
                   ai_source_ref: Ecto.UUID.generate(),
                   sus_notes: [
                     %{type: "spam", evidence: "seed evidence", explanation: "seed explanation"}
                   ],
                   summary: "earlier concern"
                 },
                 Ecto.UUID.generate()
               )
             end)

    assert {:ok, {:ok, _item}} =
             Repo.transaction(fn ->
               AlertWall.supersede_in_transaction(item.id, Ecto.UUID.generate(), :cms)
             end)

    query = """
    query WallHistory($scope: ReviewBotScopeInput!, $filter: AlertItemFilter) {
      alertItems(scope: $scope, filter: $filter) {
        entries { id status reportCount totalReportCount susNotes { type evidence explanation } }
      }
    }
    """

    assert {:ok, %{data: %{"alertItems" => %{"entries" => entries}}}} =
             Absinthe.run(query, Schema,
               variables: %{
                 "scope" => %{"type" => "PLATFORM"},
                 "filter" => %{"closed" => true}
               },
               context: %{cur_user: reviewer}
             )

    persisted = Repo.get!(Item, item.id)
    assert [%{"explanation" => "seed explanation"}] = persisted.sus_notes
    earlier = Enum.find(entries, &(&1["id"] == to_string(item.id)))
    assert earlier["status"] == "SUPERSEDED"

    assert earlier["susNotes"] == [
             %{
               "type" => "spam",
               "evidence" => "seed evidence",
               "explanation" => "seed explanation"
             }
           ]
  end

  defp put_community_permission(user, slug, permission) do
    passport = Map.put(user.cur_passport || %{}, slug, %{"cms" => %{permission => true}})
    %{user | cur_passport: Map.put_new(passport, "global", %{})}
  end
end
