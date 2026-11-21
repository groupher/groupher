defmodule GroupherServer.TestWeb.Schema.ReviewBotAlertWallMutationTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer
  alias GroupherServer.{AlertWall, Repo}
  alias GroupherServer.CMS.Model.{Community, CommunityAdmin, GlobalPassport}
  alias AlertWall.Model.Item
  alias GroupherServerWeb.Schema

  test "review mutations expose only the V2 action contract" do
    fields = Schema.__absinthe_type__(:cms_review_mutations).fields

    assert Map.has_key?(fields, :recheck_article_v2)
    assert Map.has_key?(fields, :recheck_comment_v2)
    refute Map.has_key?(fields, :recheck_doc_v2)
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
    mutation Recheck($target: ArtimentReviewTargetInput!, $scope: ReviewBotScopeInput!, $commandId: ID!) {
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
    reviewer = grant_global_permissions(reviewer, %{"review.platform.decide" => true})

    mutation = """
    mutation Recheck($target: ArtimentReviewTargetInput!, $scope: ReviewBotScopeInput!, $commandId: ID!) {
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

  test "a Doc recheck uses the shared Article command" do
    {community, doc, _attrs, reviewer} = mock_article(:doc)
    reviewer = put_community_permission(reviewer, community.slug, "review.decide")

    mutation = """
    mutation Recheck($target: ArtimentReviewTargetInput!, $scope: ReviewBotScopeInput!, $commandId: ID!) {
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
                   "articleId" => doc.id,
                   "communityId" => community.id
                 },
                 "scope" => %{"type" => "COMMUNITY", "community" => community.slug},
                 "commandId" => Ecto.UUID.generate()
               },
               context: %{cur_user: reviewer}
             )

    assert result["action"] == "RECHECK"
    assert result["targetType"] == "ARTICLE"
    assert result["targetId"] == doc.id
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
    mutation Decide($target: ArtimentReviewTargetInput!, $commandId: ID!) {
      rejectArticleV2(target: $target, commandId: $commandId) { action }
    }
    """

    assert {:ok, %{data: %{"rejectArticleV2" => %{"action" => "REJECT"}}}} =
             Absinthe.run(reject, Schema, variables: variables, context: %{cur_user: reviewer})

    approve = """
    mutation Decide($target: ArtimentReviewTargetInput!, $commandId: ID!) {
      approveArticleV2(target: $target, commandId: $commandId) { action }
    }
    """

    variables = Map.put(variables, "commandId", Ecto.UUID.generate())

    assert {:ok, %{data: %{"approveArticleV2" => %{"action" => "APPROVE"}}}} =
             Absinthe.run(approve, Schema, variables: variables, context: %{cur_user: reviewer})
  end

  test "submitReport succeeds through GraphQL" do
    {community, post, _attrs, reporter} = mock_article(:post)
    observed_version = public_article_version(post)

    assert {:ok, public_article} =
             GroupherServer.CMS.FrontDesk.article(%{
               community: community.slug,
               thread: :post,
               inner_id: Integer.to_string(article_inner_id(post, community))
             })

    assert public_article.version == observed_version

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
                     "observedVersion" => observed_version,
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
    query Notice($target: ArtimentReviewTargetInput!) {
      artimentReviewNotice(target: $target) { status failureCode }
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

    assert {:ok, %{data: %{"artimentReviewNotice" => notice}}} =
             Absinthe.run(query, Schema, variables: variables, context: %{cur_user: author})

    assert Map.keys(notice) |> Enum.sort() == ["failureCode", "status"]

    assert {:ok, %{data: %{"artimentReviewNotice" => nil}, errors: [_ | _]}} =
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
                   observed_version: public_article_version(post)
                 },
                 :spam,
                 "Please review this post",
                 reporter,
                 Ecto.UUID.generate()
               )
    end)

    query = """
    query Notice($target: ArtimentReviewTargetInput!) {
      artimentReviewNotice(target: $target) { status failureCode }
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

    assert {:ok, %{data: %{"artimentReviewNotice" => %{"status" => "waiting_human"}}}} =
             Absinthe.run(query, Schema, variables: variables, context: %{cur_user: author})
  end

  defp public_article_version(article) do
    snapshot_id = Repo.get!(GroupherServer.CMS.Model.ArticlePublic, article.id).snapshot_id
    GroupherServer.CMS.Review.SnapshotVersion.from_id(snapshot_id)
  end

  test "artimentReviewHistory exposes a failed check for manual recheck" do
    {_community, post, _attrs, reviewer} = mock_article(:post)
    reviewer = grant_global_permissions(reviewer, %{"review.platform.read" => true})

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
    query History($target: ArtimentReviewTargetInput!) {
      artimentReviewHistory(target: $target) {
        artimentReviewId
        state
        failureCode
        failureMessage
        outdatedAt
      }
    }
    """

    assert {:ok, %{data: %{"artimentReviewHistory" => [entry | _]}}} =
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
    reviewer = grant_global_permissions(reviewer, %{"review.platform.read" => true})

    query = """
    query History($target: ArtimentReviewTargetInput!) {
      artimentReviewHistory(target: $target) { artimentReviewId communityId }
    }
    """

    assert {:ok, %{data: %{"artimentReviewHistory" => [entry | _]}}} =
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
    reviewer = put_community_permission(user, community.slug, "review.configure")

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
    reviewer = grant_global_permissions(reviewer, %{"review.platform.decide" => true})

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
    reviewer = grant_global_permissions(reviewer, %{"review.platform.read" => true})

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
    community = Repo.get_by!(Community, slug: slug)

    member =
      Repo.get_by(CommunityAdmin, user_id: user.id, community_id: community.id) ||
        %CommunityAdmin{}

    member
    |> CommunityAdmin.changeset(%{
      user_id: user.id,
      community_id: community.id,
      permissions: Map.put(member.permissions || %{}, permission, true)
    })
    |> Repo.insert_or_update!()

    user
  end

  defp grant_global_permissions(user, permissions) do
    (Repo.get_by(GlobalPassport, user_id: user.id) || %GlobalPassport{})
    |> GlobalPassport.changeset(%{
      user_id: user.id,
      is_root: false,
      permissions: permissions
    })
    |> Repo.insert_or_update!()

    user
  end
end
