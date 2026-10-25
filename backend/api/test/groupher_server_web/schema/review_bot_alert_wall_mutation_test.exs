defmodule GroupherServer.TestWeb.Schema.ReviewBotAlertWallMutationTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer
  alias GroupherServer.{AlertWall, Repo}
  alias AlertWall.Model.Item
  alias GroupherServerWeb.Schema

  test "recheck mutations are named for supported CMS targets" do
    fields = Schema.__absinthe_type__(:cms_review_mutations).fields

    assert Map.has_key?(fields, :recheck_article)
    assert Map.has_key?(fields, :recheck_comment)
    refute Map.has_key?(fields, :recheck_review_target)
  end

  test "recheckArticle succeeds through GraphQL" do
    {community, post, _attrs, reviewer} = mock_article(:post)
    reviewer = put_community_permission(reviewer, community.slug, "review.decide")

    mutation = """
    mutation Recheck($target: CmsReviewTargetInput!, $scope: ReviewBotScopeInput!, $commandId: ID!) {
      recheckArticle(target: $target, scope: $scope, commandId: $commandId) {
        commandId
        targetType
        targetId
        action
      }
    }
    """

    assert {:ok, %{data: %{"recheckArticle" => result}}} =
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

    assert result["action"] == "recheck"
    assert result["targetType"] == "ARTICLE"
    assert result["targetId"] == to_string(post.id)
  end

  test "recheckComment succeeds through GraphQL" do
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
    reviewer = put_community_permission(reviewer, community.slug, "review.decide")

    mutation = """
    mutation Recheck($target: CmsReviewTargetInput!, $scope: ReviewBotScopeInput!, $commandId: ID!) {
      recheckComment(target: $target, scope: $scope, commandId: $commandId) {
        commandId
        targetType
        targetId
        action
      }
    }
    """

    assert {:ok, %{data: %{"recheckComment" => result}}} =
             Absinthe.run(mutation, Schema,
               variables: %{
                 "target" => %{
                   "type" => "COMMENT",
                   "commentId" => comment.id,
                   "communityId" => community.id
                 },
                 "scope" => %{"type" => "COMMUNITY", "community" => community.slug},
                 "commandId" => Ecto.UUID.generate()
               },
               context: %{cur_user: reviewer}
             )

    assert result["action"] == "recheck"
    assert result["targetType"] == "COMMENT"
    assert result["targetId"] == to_string(comment.id)
  end

  test "submitReport succeeds through GraphQL" do
    {community, post, _attrs, reporter} = mock_article(:post)

    mutation = """
    mutation Submit($input: AlertReportInput!, $commandId: ID!) {
      submitReport(input: $input, commandId: $commandId) {
        id
        subjectRef
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

    assert report["subjectRef"]
    assert report["reportType"] == "SPAM"
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
                   subject_ref: "graphql-resolve-v1",
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

  defp put_community_permission(user, slug, permission) do
    passport = Map.put(user.cur_passport || %{}, slug, %{"cms" => %{permission => true}})
    %{user | cur_passport: Map.put_new(passport, "global", %{})}
  end
end
