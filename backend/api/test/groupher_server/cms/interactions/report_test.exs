defmodule GroupherServer.Test.CMS.Interactions.ReportTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Interactions.ErrorCat

  test "report identity uses immutable user id rather than login" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, _canonical} = CMS.Interactions.report(post, "spam", "details", user)

    renamed_user = %{user | login: "renamed-#{user.id}"}

    assert {:error, duplicate} =
             CMS.Interactions.report(post, "other", "details", renamed_user)

    assert duplicate.reason == ErrorCat.already_reported().reason

    assert {:ok, _canonical} = CMS.Interactions.undo_report(post, renamed_user)

    assert %{reported_count: 0, viewer_has_reported: false} =
             CMS.Interactions.viewer_state(post, renamed_user, surface: :report)
  end

  test "undo report is idempotent and never decrements State twice" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, _canonical} = CMS.Interactions.report(post, "spam", "details", user)
    assert {:ok, _canonical} = CMS.Interactions.undo_report(post, user)
    assert {:ok, _canonical} = CMS.Interactions.undo_report(post, user)

    assert %{reported_count: 0, viewer_has_reported: false} =
             CMS.Interactions.viewer_state(post, user, surface: :report)
  end
end
