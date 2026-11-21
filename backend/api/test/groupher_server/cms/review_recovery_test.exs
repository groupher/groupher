defmodule GroupherServer.Test.CMS.Review.RecoveryTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Model.{ArticleLifecycle, ArticlePublic, ArtimentReview}
  alias CMS.Outbox.{Event, Retry}

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    {community, article, _, actor} = mock_article(:post)
    %{community: community, article: article, root: actor}
  end

  test "a current request with retained payload can recover its original effect", ctx do
    {request, event} = request(ctx)
    assert {:ok, %{outcome: :requeued}} = recover(ctx, event)
    assert Repo.get!(ArtimentReview, request.id) == request
    current = Repo.get!(Event, event.id)
    assert current.status == :waiting
    assert current.operation_ref == request.operation_ref
    assert current.dedupe_key == event.dedupe_key
    assert current.data == event.data
    retry = Repo.get_by!(Retry, event_id: event.id)
    assert retry.original_operation_ref == request.operation_ref
    refute retry.retry_operation_ref == request.operation_ref
  end

  test "completed opinions recover by acknowledgement without restoring private payload", ctx do
    {request, event} = request(ctx)

    request =
      Repo.update!(
        ArtimentReview.changeset(request, %{
          state: :completed,
          result: %{"status" => "clear"},
          payload: %{},
          applied_at: DateTime.utc_now(:second)
        })
      )

    assert {:ok, %{outcome: :requeued}} = recover(ctx, event)

    assert {:ok, :pass} =
             GroupherServer.Jobs.CMSArtimentReview.perform(%Oban.Job{
               args: %{"event_id" => event.id},
               attempt: 1,
               max_attempts: 8
             })

    assert Repo.get!(ArtimentReview, request.id) == request
    assert Repo.get!(Event, event.id).status == :done
  end

  test "expired, replaced, outdated, failed and empty requests cannot reset delivery or audit",
       ctx do
    now = DateTime.utc_now(:second)

    for changes <- [
          %{payload_expires_at: DateTime.add(now, -1, :second)},
          %{replaced_at: now},
          %{outdated_at: now},
          %{state: :failed, payload: %{}, result: %{"error" => "payload_expired"}},
          %{payload: %{}},
          %{state: :completed, result: nil}
        ] do
      {request, event} = request(ctx)
      Repo.update!(ArtimentReview.changeset(request, changes))
      assert_refused(ctx, event)
    end
  end

  test "a mismatched request identity or operation never becomes a new review", ctx do
    {_request, event} = request(ctx)
    original_data = event.data

    event =
      Repo.update!(
        Ecto.Changeset.change(event,
          data: Map.put(event.data, "request_id", Ecto.UUID.generate())
        )
      )

    assert_refused(ctx, event)

    event =
      Repo.update!(
        Ecto.Changeset.change(event, data: original_data, operation_ref: Ecto.UUID.generate())
      )

    assert_refused(ctx, event)
  end

  test "a deleted canonical resource is not revived by retrying its review", ctx do
    {_request, event} = request(ctx)
    life = Repo.get_by!(ArticleLifecycle, article_id: ctx.article.id)

    Repo.update!(
      Ecto.Changeset.change(life, state: :deleted, deleted_at: DateTime.utc_now(:second))
    )

    assert_refused(ctx, event)
  end

  test "missing public content or request rows fail before enqueue", ctx do
    {request, event} = request(ctx)
    Repo.delete!(Repo.get!(ArticlePublic, ctx.article.id))
    assert_refused(ctx, event)
    Repo.delete!(request)
    assert_refused(ctx, event)
  end

  defp request(ctx) do
    {:ok, request} =
      Repo.transact_result(fn ->
        CMS.Review.Requests.create_in_transaction(%{
          target_type: :article,
          article_id: ctx.article.id,
          community_id: ctx.community.id,
          operation_ref: Ecto.UUID.generate(),
          policy_snapshot: %{"review_mode" => "immediate"},
          payload: %{"text" => %{"title" => "Review", "body" => "Current public content"}}
        })
      end)

    event = Repo.get_by!(Event, event: "cms.artiment_review", resource_id: request.id)

    assert {:error, _} =
             CMS.Outbox.execute(event.id, fn _ -> {:error, :temporary_review_failure} end,
               on_error: :fail
             )

    {request, Repo.get!(Event, event.id)}
  end

  defp assert_refused(ctx, event) do
    requests = Repo.all(ArtimentReview) |> Enum.sort_by(& &1.id)
    jobs = Repo.all(Oban.Job)
    retries = Repo.all(Retry)
    assert {:error, :review_request_not_recoverable} = recover(ctx, event)
    assert Repo.get!(Event, event.id) == event
    assert Repo.all(ArtimentReview) |> Enum.sort_by(& &1.id) == requests
    assert Repo.all(Oban.Job) == jobs
    assert Repo.all(Retry) == retries
  end

  defp recover(ctx, event) do
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)

    try do
      CMS.retry_outbox_event(event.id, 1, ctx.root, "review delivery recovered")
    after
      Application.put_env(:groupher_server, :env, previous)
    end
  end
end
