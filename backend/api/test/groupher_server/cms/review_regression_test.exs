defmodule GroupherServer.Test.CMS.ReviewRegressionTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{AlertWall, CMS, Repo}

  alias CMS.Model.{
    ArticleLifecycle,
    ArtimentReview,
    CommentLifecycle,
    ArticlePublic,
    CommunityAdmin
  }

  test "report threshold rejects incomplete versioned facts" do
    assert {:error, %{reason: :invalid_review_block}} =
             Repo.transact_result(fn ->
               CMS.apply_report_threshold_in_transaction(%{
                 owner: :cms,
                 item_id: 1,
                 target_type: :article,
                 target_id: Ecto.UUID.generate(),
                 community_id: 1,
                 observed_version: 1,
                 operation_ref: Ecto.UUID.generate()
               })
             end)
  end

  for target_type <- [:article, :comment, :doc, :doc_comment] do
    @target_type target_type
    test "#{target_type} restriction retries reuse the active hold across timestamps" do
      {lifecycle, scope_key} = restriction_target(@target_type)
      applied_at = DateTime.utc_now(:second)

      attrs = %{
        operation_ref: Ecto.UUID.generate(),
        scope_key: scope_key,
        type: :report_threshold_hold,
        source: :domain,
        source_ref: "report_threshold:regression",
        applied_at: applied_at
      }

      assert {:ok, first} =
               Repo.transact_result(fn -> CMS.Review.Restrictions.apply(lifecycle, attrs) end)

      retry_attrs = %{attrs | applied_at: DateTime.add(applied_at, 2, :second)}

      assert {:ok, retry} =
               Repo.transact_result(fn ->
                 CMS.Review.Restrictions.apply(lifecycle, retry_attrs)
               end)

      assert retry.id == first.id
      assert retry.applied_at == first.applied_at
      assert retry.version == first.version
    end
  end

  test "Doc Comment author notices include current checks and platform holds" do
    {community, _doc, author, comment} = doc_comment()
    target = %{type: :comment, comment_id: comment.id, community_id: community.id}
    operation_ref = Ecto.UUID.generate()

    assert {:ok, request} =
             Repo.transact_result(fn ->
               CMS.Review.Requests.create_in_transaction(%{
                 operation_ref: operation_ref,
                 target_type: :comment,
                 comment_id: comment.id,
                 community_id: community.id,
                 policy_snapshot: %{"review_mode" => "immediate"},
                 payload: %{"text" => %{"title" => "Doc", "body" => "Comment"}}
               })
             end)

    assert {:ok, %{status: "checking"}} = CMS.Review.Notice.for_author(target, author)

    request
    |> ArtimentReview.changeset(%{state: :failed, result: %{"code" => "provider_unavailable"}})
    |> Repo.update!()

    assert {:ok, %{status: "failed", failure_code: "provider_unavailable"}} =
             CMS.Review.Notice.for_author(target, author)

    lifecycle = Repo.get_by!(CommentLifecycle, comment_id: comment.id)

    assert {:ok, _hold} =
             Repo.transact_result(fn ->
               CMS.Review.Restrictions.apply(lifecycle, %{
                 scope_key: "platform",
                 type: :report_threshold_hold,
                 source: :domain,
                 source_ref: "report_threshold:notice",
                 operation_ref: Ecto.UUID.generate()
               })
             end)

    assert {:ok, %{status: "waiting_human"}} = CMS.Review.Notice.for_author(target, author)
  end

  test "Doc Comment report resolver retains the entry Community but creates a platform hold" do
    {community, doc, _author, comment} = doc_comment()

    path = %{
      article: %{
        community: community.slug,
        thread: :doc,
        inner_id: article_inner_id(doc, community)
      },
      inner_id: comment.inner_id
    }

    reports =
      Enum.map(1..CMS.Review.Config.report_threshold(), fn _ ->
        {:ok, reporter} = db_insert(:user)

        assert {:ok, report} =
                 GroupherServerWeb.Resolvers.AlertWall.submit_report(
                   nil,
                   %{
                     input: %{
                       target: %{type: :comment, comment: path, observed_version: 1},
                       report_type: :spam,
                       details: "Please review this Doc Comment"
                     },
                     command_id: Ecto.UUID.generate()
                   },
                   %{context: %{cur_user: reporter}}
                 )

        report
      end)

    item_id = List.last(reports).item_id
    assert Enum.all?(reports, &(&1.item_id == item_id))
    assert Repo.get!(AlertWall.Model.Item, item_id).community_id == community.id
    hold = Repo.get_by!(CMS.Model.CommentReviewBlock, comment_id: comment.id)
    assert is_nil(hold.community_id)
    assert hold.type == :report_threshold_hold
    assert hold.source_ref == "report_threshold:item:#{item_id}"
  end

  test "Doc Comment recheck reads its public title and Comment body through the command" do
    {community, doc, _author, comment} = doc_comment()
    reviewer = reviewer(community)
    command_id = Ecto.UUID.generate()
    public = Repo.get_by!(ArticlePublic, article_id: comment.article_id)
    body = Repo.get_by!(CMS.Model.CommentBody, comment_id: comment.id)

    assert {:ok, result} =
             CMS.recheck_review_target(
               "comment:#{comment.id}",
               "community:#{community.id}",
               reviewer,
               command_id
             )

    assert result.action == :recheck
    assert result.request_count == 1

    request =
      Repo.one!(
        from(request in ArtimentReview,
          where:
            request.comment_id == ^comment.id and request.community_id == ^community.id and
              is_nil(request.replaced_at)
        )
      )

    refute Map.has_key?(request, :branch_id)
    assert request.payload["text"]["title"] == public.title
    assert request.payload["text"]["body"] == body.plain_text

    assert {:ok, ^result} =
             CMS.recheck_review_target(
               "comment:#{comment.id}",
               "community:#{community.id}",
               reviewer,
               command_id
             )

    {:ok, other_community} = mock_community(reviewer)

    assert {:error, _reason} =
             CMS.recheck_review_target(
               "comment:#{comment.id}",
               "community:#{other_community.id}",
               reviewer(other_community),
               Ecto.UUID.generate()
             )

    Repo.delete!(public)

    assert {:error, %{reason: :invalid_review_block}} =
             CMS.recheck_review_target(
               "comment:#{comment.id}",
               "community:#{community.id}",
               reviewer,
               Ecto.UUID.generate()
             )

    assert doc.id == comment.article_id
  end

  defp restriction_target(:article) do
    {community, article, _attrs, _author} = mock_article(:post)
    {Repo.get_by!(ArticleLifecycle, article_id: article.id), "community:#{community.id}"}
  end

  defp restriction_target(:doc) do
    {_community, doc, _attrs, _author} = mock_article(:doc)
    {Repo.get_by!(ArticleLifecycle, article_id: doc.id), "platform"}
  end

  defp restriction_target(:doc_comment) do
    {community, _doc, _author, comment} = doc_comment()
    {Repo.get_by!(CommentLifecycle, comment_id: comment.id), "community:#{community.id}"}
  end

  defp restriction_target(:comment) do
    {community, article, _attrs, author} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        binding_inner_id(article, community),
        mock_comment("Shared review candidate"),
        author,
        Ecto.UUID.generate()
      )

    {Repo.get_by!(CommentLifecycle, comment_id: comment.id), "platform"}
  end

  defp doc_comment do
    {community, doc, _attrs, author} = mock_article(:doc)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :doc,
        binding_inner_id(doc, community),
        mock_comment("Doc review candidate"),
        author,
        Ecto.UUID.generate()
      )

    {community, doc, author, comment}
  end

  defp binding_inner_id(article, community) do
    assert {:ok, %{inner_id: inner_id}} = CMS.Articles.Bindings.get(article, community)
    inner_id
  end

  defp reviewer(community) do
    {:ok, user} = db_insert(:user)

    member =
      Repo.get_by(CommunityAdmin, user_id: user.id, community_id: community.id) ||
        %CommunityAdmin{}

    member
    |> CommunityAdmin.changeset(%{
      user_id: user.id,
      community_id: community.id,
      permissions: Map.put(member.permissions || %{}, "review.decide", true)
    })
    |> Repo.insert_or_update!()

    user
  end
end
