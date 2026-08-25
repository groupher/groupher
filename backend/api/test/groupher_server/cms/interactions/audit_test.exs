defmodule GroupherServer.Test.CMS.Interactions.AuditTest do
  use GroupherServer.TestMate

  alias GroupherServer.CMS.Interactions.Audit
  alias GroupherServer.Repo

  test "repairs a drifted article upvote bitmap from the fact table" do
    {_community, post, _attrs, user} = mock_article(:post)
    post = Repo.preload(post, author: :user)
    {:ok, _} = CMS.Interactions.upvote(post, user)

    Repo.query!(
      """
      UPDATE cms.post_reaction_infos
      SET upvoted_user_ids = '{}'::roaringbitmap64, upvotes_count = 99
      WHERE post_id = $1
      """,
      [post.id]
    )

    assert {:ok, %{repairs: repairs}} = Audit.verify_and_repair()
    assert repairs >= 1
    assert CMS.Interactions.viewer_state(post, user).viewer_has_upvoted
    assert CMS.Interactions.viewer_state(post, nil).upvotes_count == 1
  end

  test "accepts nullable report case payloads" do
    {_community, post, _attrs, _user} = mock_article(:post)
    now = DateTime.utc_now(:second)

    Repo.query!(
      """
      INSERT INTO cms.abuse_reports (post_id, report_cases, inserted_at, updated_at)
      VALUES ($1, NULL, $2, $2)
      """,
      [post.id, now]
    )

    assert {:ok, %{repairs: repairs}} = Audit.verify_and_repair()
    assert is_integer(repairs)
  end

  test "reports malformed reporter identities and stored report count drift without changing facts" do
    {_community, post, _attrs, user} = mock_article(:post)
    now = DateTime.utc_now(:second)

    %{rows: [[report_id]]} =
      Repo.query!(
        """
        INSERT INTO cms.abuse_reports
          (post_id, report_cases, report_cases_count, inserted_at, updated_at)
        VALUES
          ($1, jsonb_build_array(jsonb_build_object('user', jsonb_build_object('user_id', NULL))), 9, $2, $2)
        RETURNING id
        """,
        [post.id, now]
      )

    Repo.query!(
      """
      INSERT INTO cms.abuse_reports
        (post_id, report_cases, report_cases_count, inserted_at, updated_at)
      VALUES
        ($1, jsonb_build_array(jsonb_build_object('user', jsonb_build_object('user_id', $3::bigint))), 1, $2, $2),
        ($1, jsonb_build_array(jsonb_build_object('user', jsonb_build_object('user_id', $3::bigint))), 1, $2, $2)
      """,
      [post.id, now, user.id]
    )

    assert {:ok, %{issue_count: issue_count, issues: issues}} = Audit.report_fact_issues()
    assert issue_count >= 2

    target_id = post.id
    reporter_id = user.id

    assert Enum.any?(issues, &match?(%{issue: "orphan_reporter_case", report_id: ^report_id}, &1))

    assert Enum.any?(
             issues,
             &match?(%{issue: "multiple_report_rows", target_id: ^target_id, actual_count: 3}, &1)
           )

    assert Enum.any?(
             issues,
             &match?(
               %{
                 issue: "duplicate_reporter_cases",
                 reporter_user_id: ^reporter_id,
                 actual_count: 2
               },
               &1
             )
           )

    assert Enum.any?(
             issues,
             &match?(
               %{
                 issue: "report_cases_count_mismatch",
                 report_id: ^report_id,
                 actual_count: 1,
                 stored_count: 9
               },
               &1
             )
           )

    assert %{rows: [[9]]} =
             Repo.query!("SELECT report_cases_count FROM cms.abuse_reports WHERE id = $1", [
               report_id
             ])
  end
end
