defmodule GroupherServer.Test.CMS.Comments.JobPolicy do
  use GroupherServer.TestMate, async: false

  import Ecto.Query, warn: false
  import ExUnit.CaptureLog

  alias GroupherServer.CMS.Model.{Comment, Post}
  alias GroupherServer.CMS.Comments.JobPolicy
  alias GroupherServer.CMS.Gate.Access
  alias GroupherServer.Jobs.Comments, as: CommentsJob
  alias Helper.ORM

  setup do
    oban_config =
      :groupher_server
      |> Application.fetch_env!(Oban)
      |> Keyword.merge(testing: :manual, queues: false, plugins: false)

    start_supervised!({Oban, oban_config})

    previous_env = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :test_jobs)

    on_exit(fn -> Application.put_env(:groupher_server, :env, previous_env) end)

    :ok
  end

  test "required audition enqueue failure rolls back comment creation" do
    {community, post, _, actor} = mock_article(:post, preload: [author: :user])
    reject_job_kind(:audition)

    assert_raise Ecto.ConstraintError, fn ->
      CMS.Comments.create_comment(
        community,
        :post,
        post.inner_id,
        mock_comment(),
        actor
      )
    end

    assert Repo.aggregate(from(comment in Comment, where: comment.post_id == ^post.id), :count) ==
             0
  end

  test "required audition enqueue failure rolls back reply creation and counters" do
    {community, post, _, actor} = mock_article(:post, preload: [author: :user])

    assert {:ok, %Comment{} = parent} =
             CMS.Comments.create_comment(
               community,
               :post,
               post.inner_id,
               mock_comment("parent"),
               actor
             )

    reject_job_kind(:audition)

    assert_raise Ecto.ConstraintError, fn ->
      CMS.Comments.reply_comment(parent.id, mock_comment("reply"), actor)
    end

    assert Repo.aggregate(from(comment in Comment, where: comment.post_id == ^post.id), :count) ==
             1

    assert Repo.get!(Comment, parent.id).replies_count == 0
    assert Repo.get!(Post, post.id).comments_count == 1
  end

  test "required audition enqueue failure rolls back comment update" do
    {community, post, _, actor} = mock_article(:post, preload: [author: :user])

    assert {:ok, %Comment{} = comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               post.inner_id,
               mock_comment("before"),
               actor
             )

    reject_job_kind(:audition)

    assert_raise Ecto.ConstraintError, fn ->
      CMS.Comments.update_comment(comment, mock_comment("after"), actor)
    end

    persisted = Repo.get!(Comment, comment.id)
    assert persisted.body_html =~ "before"
    refute persisted.body_html =~ "after"
  end

  test "application-level Oban changeset errors become a stable domain error and roll back" do
    {community, post, _, actor} = mock_article(:post, preload: [author: :user])

    assert {:ok, %Comment{} = comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               post.inner_id,
               mock_comment("before"),
               actor
             )

    invalid_enqueue = fn _comment ->
      invalid_changeset =
        %{}
        |> CommentsJob.new()
        |> Ecto.Changeset.add_error(:args, "payload is required")

      Oban.insert(invalid_changeset)
    end

    assert {:error,
            %{
              reason: :required_job_enqueue_failed,
              details: %{job: :audition, failure: :validation}
            }} =
             Access.with_check(actor, :edit, comment, fn canonical ->
               with {:ok, updated} <- ORM.update(canonical, %{body_html: "must rollback"}),
                    {:ok, _job} <- JobPolicy.audition(updated, invalid_enqueue) do
                 {:ok, updated}
               end
             end)

    assert Repo.get!(Comment, comment.id).body_html =~ "before"
  end

  test "optional mention enqueue failure preserves a committed comment" do
    {community, post, _, actor} = mock_article(:post, preload: [author: :user])
    reject_job_kind(:sync_mentions)

    log =
      capture_log(fn ->
        assert {:ok, %Comment{} = comment} =
                 CMS.Comments.create_comment(
                   community,
                   :post,
                   post.inner_id,
                   mock_comment(),
                   actor
                 )

        assert Repo.get!(Comment, comment.id)
      end)

    assert log =~ "optional job enqueue failed job=sync_mentions"
  end

  test "participant repair enqueue failure preserves a successful read" do
    {community, post, _, actor} = mock_article(:post, preload: [author: :user])

    assert {:ok, _} =
             CMS.Comments.create_comment(
               community,
               :post,
               post.inner_id,
               mock_comment(),
               actor
             )

    assert {:ok, _} = ORM.update(post, %{comments_participants_count: 99})
    reject_job_kind(:reconcile_comments_participants)

    log =
      capture_log(fn ->
        assert {:ok, page} =
                 CMS.Comments.paged_comments_participants(:post, post.id, %{page: 1, size: 20})

        assert page.total_count == 1
      end)

    assert log =~ "optional job enqueue failed job=reconcile_comments_participants"
    assert Repo.get!(Post, post.id).comments_participants_count == 99
  end

  defp reject_job_kind(kind) when is_atom(kind) do
    suffix = Atom.to_string(kind)
    constraint_name = "reject_#{suffix}_job_insert"

    # The test Sandbox rolls this table DDL back with each test. Dropping first
    # also makes a rerun recover from a prior non-transactional or interrupted
    # run; a future non-Sandbox test mode must add explicit teardown as well.
    Repo.query!("""
    ALTER TABLE public.oban_jobs
    DROP CONSTRAINT IF EXISTS #{constraint_name}
    """)

    Repo.query!("""
    ALTER TABLE public.oban_jobs
    ADD CONSTRAINT #{constraint_name}
    CHECK ((args->>'kind') IS DISTINCT FROM '#{suffix}') NOT VALID
    """)
  end
end
