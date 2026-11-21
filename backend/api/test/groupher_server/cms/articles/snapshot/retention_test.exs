defmodule GroupherServer.Test.CMS.Articles.Snapshot.RetentionTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Repo}

  @worker "GroupherServer.Jobs.ArticleSnapshotCleanup"
  @migration GroupherServer.Repo.Migrations.CancelArticleSnapshotCleanup

  setup_all do
    unless Code.ensure_loaded?(@migration) do
      Code.require_file("priv/repo/migrations/20261112120000_cancel_article_snapshot_cleanup.exs")
    end

    :ok
  end

  test "retirement cancels every runnable cleanup page, preserving other jobs and terminal states" do
    states = ~w(available scheduled retryable executing completed cancelled discarded)

    jobs =
      for worker <- [@worker, "GroupherServer.Jobs.UnrelatedRetentionTest"], state <- states do
        %{rows: [[id]]} =
          Repo.query!(
            """
            INSERT INTO public.oban_jobs (worker, state, args)
            VALUES ($1, $2::public.oban_job_state, $3) RETURNING id
            """,
            [worker, state, %{"cursor_id" => Ecto.UUID.generate(), "cycle_id" => "42"}]
          )

        {id, worker, state}
      end

    run_migration(:up)

    for {id, worker, original} <- jobs do
      job = Repo.get!(Oban.Job, id)

      if worker == @worker and original in ~w(available scheduled retryable executing) do
        assert job.state == "cancelled"
        assert job.cancelled_at
      else
        assert job.state == original
        assert job.cancelled_at == nil
      end
    end

    before = Enum.map(jobs, fn {id, _, _} -> Repo.get!(Oban.Job, id) end)
    run_migration(:up)
    run_migration(:down)
    assert before == Enum.map(jobs, fn {id, _, _} -> Repo.get!(Oban.Job, id) end)
  end

  test "there is no scheduled or manual time-based Snapshot cleanup entrypoint" do
    Code.ensure_loaded!(CMS)
    Code.ensure_loaded!(CMS.Articles)
    refute function_exported?(CMS, :articles_cleanup_expired_snapshots, 0)
    refute function_exported?(CMS, :articles_cleanup_expired_snapshots, 1)
    refute function_exported?(CMS, :articles_cleanup_expired_snapshots_page, 1)
    refute function_exported?(CMS.Articles, :cleanup_expired_snapshots, 0)
    refute function_exported?(CMS.Articles, :cleanup_expired_snapshots, 1)
    refute function_exported?(CMS.Articles, :cleanup_expired_snapshots_page, 1)
    refute Code.ensure_loaded?(GroupherServer.Jobs.ArticleSnapshotCleanup)
    refute Code.ensure_loaded?(CMS.Articles.SnapshotCleanup)

    refute File.read!("config/config.exs") =~ @worker
  end

  defp run_migration(operation) do
    Ecto.Migration.Runner.run(
      Repo,
      Repo.config(),
      20_261_112_120_000,
      @migration,
      :forward,
      operation,
      :up,
      log: false
    )
  end
end
