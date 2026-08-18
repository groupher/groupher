defmodule GroupherServer.Test.CMS.Interactions.AuditTest do
  use GroupherServer.TestMate

  alias GroupherServer.CMS.Interactions.Audit
  alias GroupherServer.CMS.Interactions.State
  alias GroupherServer.Repo

  test "repairs a drifted article upvote bitmap from the fact table" do
    {_community, post, _attrs, user} = mock_article(:post)
    post = Repo.preload(post, author: :user)
    {:ok, _} = CMS.Articles.upvote(post, user)

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
    assert State.read(post, user).viewer_has_upvoted
    assert State.read(post).upvotes_count == 1
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
end
