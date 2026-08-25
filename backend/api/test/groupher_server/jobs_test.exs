defmodule GroupherServer.Test.Jobs do
  use ExUnit.Case, async: true

  import ExUnit.CaptureLog

  alias GroupherServer.Jobs

  describe "enqueue_best_effort/3" do
    test "passes successful enqueue results through as :ok without logging" do
      log =
        capture_log(fn ->
          assert :ok =
                   Jobs.enqueue_best_effort(:notify_comment, 42, fn ->
                     {:ok, :enqueued}
                   end)
        end)

      assert log == ""
    end

    test "contains error, unexpected result, exception, throw and exit without leaking values" do
      secret = "private-enqueue-details"

      log =
        capture_log(fn ->
          assert :ok = Jobs.enqueue_best_effort(:sync_mentions, 42, fn -> {:error, secret} end)
          assert :ok = Jobs.enqueue_best_effort(:notify_reply, 42, fn -> secret end)
          assert :ok = Jobs.enqueue_best_effort(:notify_comment, 42, fn -> raise secret end)
          assert :ok = Jobs.enqueue_best_effort(:subscribe_community, 42, fn -> throw(secret) end)

          assert :ok =
                   Jobs.enqueue_best_effort(:reconcile_comments_participants, 42, fn ->
                     exit(secret)
                   end)
        end)

      assert log =~ "job=sync_mentions resource_ref=42 failure=error_result"
      assert log =~ "job=notify_reply resource_ref=42 failure=unexpected_result"
      assert log =~ "job=notify_comment resource_ref=42 failure=exception"
      assert log =~ "job=subscribe_community resource_ref=42 failure=throw"
      assert log =~ "job=reconcile_comments_participants resource_ref=42 failure=exit"
      refute log =~ secret
    end
  end
end
