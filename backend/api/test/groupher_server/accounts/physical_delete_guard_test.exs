defmodule GroupherServer.Test.Accounts.PhysicalDeleteGuardTest do
  use GroupherServer.TestMate, async: false

  alias CMS.Model.{ArticleStats, Comment}
  alias CMS.Outbox.Event

  @constraint "account_users_physical_delete_forbidden"

  test "physical deletion is rejected even for an account without participation facts" do
    {:ok, user} = db_insert(:user)
    rejected("DELETE FROM account.users WHERE id=$1", [user.id])
    assert Repo.get!(User, user.id)
    assert_raise Ecto.ConstraintError, fn -> Repo.delete!(user, mode: :savepoint) end
    assert Repo.get!(User, user.id)
  end

  for thread <- [:post, :blog, :changelog, :doc] do
    @thread thread
    test "#{thread} reply-author DELETE/bulk DELETE/TRUNCATE preserve all facts and read projections" do
      {community, article, _, author} = mock_article(@thread)
      {:ok, replier} = db_insert(:user)

      {:ok, root} =
        CMS.Comments.create_comment(
          community,
          @thread,
          article.inner_id,
          mock_comment(),
          author,
          Ecto.UUID.generate()
        )

      {:ok, reply} =
        CMS.Comments.reply_comment(root, mock_comment(), replier, Ecto.UUID.generate())

      before = snapshot(community, article, root)
      assert before.root.replies_count == 1
      assert before.state.total_count == 2

      rejected("DELETE FROM account.users WHERE id=$1", [replier.id])
      assert snapshot(community, article, root) == before
      rejected("DELETE FROM account.users WHERE id=ANY($1::bigint[])", [[author.id, replier.id]])
      assert snapshot(community, article, root) == before
      # Flush the Sandbox's deferred owner checks so TRUNCATE reaches our guard
      # instead of PostgreSQL rejecting the fixture's pending trigger events first.
      Repo.query!("SET CONSTRAINTS ALL IMMEDIATE", [])
      rejected("TRUNCATE TABLE account.users CASCADE", [])
      assert snapshot(community, article, root) == before
      assert Repo.get!(Comment, reply.id)
      assert Repo.get!(User, replier.id)
      assert Repo.get!(User, author.id)
    end
  end

  test "ALWAYS guards still reject DELETE and TRUNCATE in replica mode" do
    {:ok, user} = db_insert(:user)
    [[original]] = Repo.query!("SHOW session_replication_role", []).rows

    try do
      Repo.query!("SET LOCAL session_replication_role=replica", [])
      rejected("DELETE FROM account.users WHERE id=$1", [user.id])
      rejected("TRUNCATE TABLE account.users CASCADE", [])
      assert Repo.get!(User, user.id)
    after
      Repo.query!("SELECT set_config('session_replication_role',$1,true)", [original])
    end
  end

  test "a rejected account DELETE rolls back earlier writes in its transaction" do
    {:ok, user} = db_insert(:user)

    assert {:error, %Postgrex.Error{postgres: %{constraint: @constraint}}} =
             Repo.transact_result(fn ->
               Repo.query!("UPDATE account.users SET nickname=$1 WHERE id=$2", [
                 "rolled back",
                 user.id
               ])

               case Repo.query("DELETE FROM account.users WHERE id=$1", [user.id]) do
                 {:error, reason} -> {:error, reason}
                 {:ok, _} -> {:ok, :unexpected_delete}
               end
             end)

    assert Repo.get!(User, user.id).nickname == user.nickname
  end

  test "normal Comment deletion keeps the account and maintains the root summary" do
    {community, article, _, author} = mock_article(:post)
    {:ok, replier} = db_insert(:user)

    {:ok, root} =
      CMS.Comments.create_comment(
        community,
        :post,
        article.inner_id,
        mock_comment(),
        author,
        Ecto.UUID.generate()
      )

    {:ok, reply} = CMS.Comments.reply_comment(root, mock_comment(), replier, Ecto.UUID.generate())
    before = snapshot(community, article, root)
    assert {:ok, _} = CMS.Comments.delete_comment(reply, replier, Ecto.UUID.generate())
    after_delete = snapshot(community, article, root)
    assert Repo.get!(User, replier.id)
    assert after_delete.root.replies_count == 0
    assert after_delete.root.reply_entries_count == 1
    assert after_delete.root.reply_participants == []
    assert after_delete.root.last_reply_at == nil
    assert after_delete.root.replies_revision == before.root.replies_revision + 1
    assert after_delete.article.comments_revision == before.article.comments_revision + 1
    assert after_delete.state.total_count == 1
    assert after_delete.search.comments_count == 1
    assert after_delete.events == before.events + 1
  end

  defp rejected(sql, params) do
    assert {:error, %Postgrex.Error{postgres: pg}} = Repo.query(sql, params, mode: :savepoint)
    assert pg.pg_code == "23514"
    assert pg.constraint == @constraint
  end

  defp snapshot(community, article, root) do
    root = Repo.get!(Comment, root.id)
    stats = Repo.get_by!(ArticleStats, article_id: article.article_id)

    {:ok, state} =
      CMS.Comments.comments_state(article.thread, article.article_id, nil, community.slug)

    {:ok, search} = CMS.ArticleStats.search_counts(article.thread, article.article_id)

    %{
      root:
        Map.take(root, [
          :replies_count,
          :reply_entries_count,
          :reply_participants,
          :last_reply_at,
          :replies_revision
        ]),
      article:
        Map.take(stats, [
          :comments_count,
          :comments_participants_count,
          :comments_participants,
          :comments_revision
        ]),
      state: %{
        total_count: state.total_count,
        participants_count: state.participants_count,
        participant_ids: Enum.map(state.participants, & &1.id)
      },
      search: search,
      facts:
        Repo.aggregate(from(c in Comment, where: c.article_id == ^article.article_id), :count),
      events:
        Repo.aggregate(
          from(e in Event,
            where: e.event == "comment.changed" and e.resource_id == ^article.article_id
          ),
          :count
        )
    }
  end
end
