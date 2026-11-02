Code.require_file(
  Path.expand(
    "../../../../priv/repo/migrations/20261102090000_align_ticket_activity_actions.exs",
    __DIR__
  )
)

defmodule GroupherServer.Test.CMS.Tickets.ActivityMigrationTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.Activity.Model.TicketLog
  alias GroupherServer.Repo.Migrations.AlignTicketActivityActions

  setup do
    {community, post, _attrs, actor} = mock_article(:post)

    actor = %{
      actor
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"ticket.create" => true, "ticket.read_internal" => true}}
        }
    }

    {:ok, ticket} =
      CMS.Tickets.create_from_post(
        community,
        post.id,
        %{title: "Migration history"},
        actor,
        Ecto.UUID.generate()
      )

    {:ok, log: Repo.get_by!(TicketLog, article_id: ticket.id, action: :created)}
  end

  for action <- ~w(update_added update_superseded) do
    test "upgrade rejects #{action} and preserves history and constraints", %{log: log} do
      run_migration(:down)
      put_action(log.id, unquote(action))

      assert_rejected_migration(:up, "ticket_activity_legacy_update_actions_require_review")
    end
  end

  for action <- ~w(public_update_published public_update_superseded) do
    test "rollback rejects #{action} and preserves history and constraints", %{log: log} do
      put_action(log.id, unquote(action))

      assert_rejected_migration(:down, "ticket_activity_public_update_actions_prevent_rollback")
    end
  end

  test "compatible history survives a down/up round trip with the expected action constraints",
       %{log: log} do
    before_rows = history_rows()
    before_constraints = constraints()

    run_migration(:down)
    assert history_rows() == before_rows
    put_action(log.id, "update_added")
    assert_action_rejected(log.id, "public_update_published")
    put_action(log.id, "created")

    run_migration(:up)
    assert history_rows() == before_rows
    assert constraints() == before_constraints
    put_action(log.id, "public_update_published")
    assert_action_rejected(log.id, "update_added")
  end

  defp run_migration(operation) do
    # Use Ecto's executor on the sandbox connection, inside its test transaction;
    # do not change schema_migrations or check out a second migrator connection.
    Ecto.Migration.Runner.run(
      Repo,
      Repo.config(),
      20_261_102_090_000,
      AlignTicketActivityActions,
      :forward,
      operation,
      operation,
      log: false
    )
  end

  defp assert_rejected_migration(operation, message) do
    before_rows = history_rows()
    before_constraints = constraints()

    assert {:ok, _} =
             Repo.transaction(fn ->
               Repo.query!("SAVEPOINT ticket_activity_migration")
               error = assert_raise Postgrex.Error, fn -> run_migration(operation) end
               assert Exception.message(error) =~ message

               Repo.query!("ROLLBACK TO SAVEPOINT ticket_activity_migration")
               Repo.query!("RELEASE SAVEPOINT ticket_activity_migration")
             end)

    assert history_rows() == before_rows
    assert constraints() == before_constraints
  end

  defp assert_action_rejected(id, action) do
    assert {:ok, _} =
             Repo.transaction(fn ->
               Repo.query!("SAVEPOINT ticket_activity_action")
               error = assert_raise Postgrex.Error, fn -> put_action(id, action) end
               assert error.postgres.constraint == "ticket_logs_action_check"
               Repo.query!("ROLLBACK TO SAVEPOINT ticket_activity_action")
               Repo.query!("RELEASE SAVEPOINT ticket_activity_action")
             end)
  end

  defp put_action(id, action) do
    Repo.query!("UPDATE activity.ticket_logs SET action = $1 WHERE id = $2", [action, id])
  end

  defp history_rows do
    Repo.query!("SELECT * FROM activity.ticket_logs ORDER BY id").rows
  end

  defp constraints do
    Repo.query!("""
    SELECT conname, pg_get_constraintdef(oid), convalidated
    FROM pg_constraint
    WHERE conrelid = 'activity.ticket_logs'::regclass
    ORDER BY conname
    """).rows
  end
end
