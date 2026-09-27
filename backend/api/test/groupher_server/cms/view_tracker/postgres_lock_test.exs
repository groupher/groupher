defmodule GroupherServer.Test.CMS.ViewTracker.PostgresLockTest do
  use ExUnit.Case, async: false

  alias GroupherServer.Repo

  test "dedupe-state UPSERT serializes with cleanup delete commit and rollback" do
    columns = """
    thread text NOT NULL,
    article_id bigint NOT NULL,
    viewer_key bytea NOT NULL,
    last_counted_at timestamptz NOT NULL,
    PRIMARY KEY (thread, article_id, viewer_key)
    """

    with_probe(columns, fn first, second, table ->
      viewer_key = :crypto.hash(:sha256, "viewer")

      for outcome <- [:commit, :rollback] do
        query!(first, "DELETE FROM #{table}")

        query!(
          first,
          "INSERT INTO #{table} VALUES ('post', 1, $1, clock_timestamp() - interval '1 day')",
          [viewer_key]
        )

        query!(first, "BEGIN")
        query!(second, "BEGIN")
        assert query!(second, "DELETE FROM #{table} WHERE article_id = 1").num_rows == 1

        upsert_task =
          assert_blocks(fn ->
            query!(
              first,
              """
              INSERT INTO #{table} AS dedupe_state
                (thread, article_id, viewer_key, last_counted_at)
              VALUES ('post', 1, $1, clock_timestamp())
              ON CONFLICT (thread, article_id, viewer_key)
              DO UPDATE SET last_counted_at = EXCLUDED.last_counted_at
              WHERE dedupe_state.last_counted_at <= clock_timestamp() - interval '10 minutes'
              RETURNING article_id
              """,
              [viewer_key]
            )
          end)

        query!(second, if(outcome == :commit, do: "COMMIT", else: "ROLLBACK"))
        assert Task.await(upsert_task, 2_000).num_rows == 1
        assert query!(first, "SELECT article_id FROM #{table}").num_rows == 1
        query!(first, "ROLLBACK")
      end
    end)
  end

  test "cleanup recheck preserves a state advanced after batch selection" do
    columns = """
    thread text NOT NULL,
    article_id bigint NOT NULL,
    viewer_key bytea NOT NULL,
    expires_at timestamptz NOT NULL,
    PRIMARY KEY (thread, article_id, viewer_key)
    """

    with_probe(columns, fn first, second, table ->
      viewer_key = :crypto.hash(:sha256, "viewer")

      query!(
        first,
        "INSERT INTO #{table} VALUES ('post', 1, $1, clock_timestamp() - interval '1 day')",
        [viewer_key]
      )

      assert query!(
               first,
               "SELECT article_id FROM #{table} WHERE expires_at <= clock_timestamp()"
             ).num_rows ==
               1

      assert query!(
               second,
               "UPDATE #{table} SET expires_at = clock_timestamp() + interval '1 day'"
             ).num_rows ==
               1

      assert query!(
               first,
               "DELETE FROM #{table} WHERE article_id = 1 AND expires_at <= clock_timestamp()"
             ).num_rows == 0

      assert query!(first, "SELECT article_id FROM #{table}").num_rows == 1
    end)
  end

  test "physical Article key-share lock serializes both delete orderings" do
    with_probe("id bigint PRIMARY KEY", fn first, second, table ->
      query!(first, "INSERT INTO #{table} VALUES (1)")
      query!(first, "BEGIN")
      assert query!(first, "SELECT id FROM #{table} WHERE id = 1 FOR KEY SHARE").num_rows == 1

      delete_task =
        assert_blocks(fn -> query!(second, "DELETE FROM #{table} WHERE id = 1") end)

      query!(first, "COMMIT")
      assert Task.await(delete_task, 2_000).num_rows == 1

      query!(first, "INSERT INTO #{table} VALUES (1)")
      query!(second, "BEGIN")
      assert query!(second, "DELETE FROM #{table} WHERE id = 1").num_rows == 1
      query!(first, "BEGIN")

      key_share_task =
        assert_blocks(fn ->
          query!(first, "SELECT id FROM #{table} WHERE id = 1 FOR KEY SHARE")
        end)

      query!(second, "COMMIT")
      assert Task.await(key_share_task, 2_000).num_rows == 0
      query!(first, "ROLLBACK")
    end)
  end

  defp with_probe(columns, fun) do
    suffix = Ecto.UUID.generate() |> String.replace("-", "")
    table = ~s["cms"."view_tracker_lock_probe_#{suffix}"]
    config = raw_postgrex_config()
    {:ok, first} = Postgrex.start_link(config)
    {:ok, second} = Postgrex.start_link(config)

    query!(first, "CREATE UNLOGGED TABLE #{table} (#{columns})")

    try do
      fun.(first, second, table)
    after
      Postgrex.query(first, "ROLLBACK", [])
      Postgrex.query(second, "ROLLBACK", [])
      Postgrex.query(first, "DROP TABLE IF EXISTS #{table}", [])
      GenServer.stop(first)
      GenServer.stop(second)
    end
  end

  defp raw_postgrex_config do
    Repo.config()
    |> Keyword.take([:hostname, :port, :username, :password, :database, :socket_dir, :ssl])
  end

  defp assert_blocks(fun) do
    caller = self()
    ref = make_ref()

    task =
      Task.async(fn ->
        send(caller, {:query_started, ref})
        fun.()
      end)

    assert_receive {:query_started, ^ref}, 500
    assert Task.yield(task, 100) == nil
    task
  end

  defp query!(connection, statement, params \\ []) do
    Postgrex.query!(connection, statement, params)
  end
end
