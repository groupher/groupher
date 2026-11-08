defmodule GroupherServer.PublicCache.CloudflareRateLimitTest do
  @moduledoc false

  use GroupherServer.DataCase, async: false

  alias GroupherServer.{CMS, PublicCache, Repo}
  alias GroupherServer.CMS.Outbox.Event
  alias GroupherServer.Jobs.CMSOutboxComment
  alias GroupherServer.Jobs.PublicCachePurge
  alias GroupherServer.PublicCache.{Cloudflare, Model.Invalidation}

  setup do
    previous = Application.get_env(:groupher_server, Cloudflare)

    Application.put_env(:groupher_server, Cloudflare,
      zone_id: "test-zone",
      api_token: "test-token",
      req_options: [plug: {Req.Test, __MODULE__}]
    )

    on_exit(fn ->
      if previous == nil do
        Application.delete_env(:groupher_server, Cloudflare)
      else
        Application.put_env(:groupher_server, Cloudflare, previous)
      end
    end)

    :ok
  end

  test "preserves Cloudflare Retry-After and snoozes the durable invalidation" do
    Req.Test.expect(__MODULE__, fn conn ->
      conn
      |> Plug.Conn.put_resp_header("retry-after", "17")
      |> Plug.Conn.put_resp_header("content-type", "application/json")
      |> Plug.Conn.resp(429, ~s({"success":false}))
    end)

    assert {:error, {:cloudflare_rate_limited, seconds}} =
             Cloudflare.purge(["community[home]"])

    assert seconds in 18..21

    assert {:ok, invalidation} =
             PublicCache.invalidate_now(
               :community_presentation_changed,
               %{community: "home"},
               causation_id: Ecto.UUID.generate()
             )

    job = %Oban.Job{
      id: 1,
      args: %{"invalidation_id" => invalidation.id},
      attempt: 1,
      max_attempts: 8
    }

    Req.Test.expect(__MODULE__, fn conn ->
      conn
      |> Plug.Conn.put_resp_header("retry-after", "17")
      |> Plug.Conn.put_resp_header("content-type", "application/json")
      |> Plug.Conn.resp(429, ~s({"success":false}))
    end)

    before = DateTime.utc_now(:second)
    assert {:snooze, seconds} = PublicCachePurge.perform(job)
    assert seconds in 18..21

    assert %Invalidation{
             status: :pending,
             attempts: 1,
             locked_at: nil,
             locked_by: nil,
             last_error_code: "cloudflare_rate_limited",
             available_at: available_at
           } = Repo.get!(Invalidation, invalidation.id)

    assert DateTime.diff(available_at, before, :second) in 17..21
    Req.Test.verify!(__MODULE__)
  end

  test "snoozes CMS comment effects after a Cloudflare rate limit" do
    Req.Test.expect(__MODULE__, fn conn ->
      conn
      |> Plug.Conn.put_resp_header("retry-after", "9")
      |> Plug.Conn.put_resp_header("content-type", "application/json")
      |> Plug.Conn.resp(429, ~s({"success":false}))
    end)

    assert {:ok, event} =
             CMS.Outbox.send(%{
               event: "comment.changed",
               worker: CMSOutboxComment,
               resource_type: "comment",
               resource_id: "429-test",
               command_id: Ecto.UUID.generate(),
               data: %{community: "home", thread: "post", inner_id: 42}
             })

    before = DateTime.utc_now(:second)

    assert {:snooze, seconds} =
             CMSOutboxComment.perform(%Oban.Job{
               id: 2,
               args: %{"event_id" => event.id},
               attempt: 1,
               max_attempts: 8
             })

    assert seconds in 10..11

    assert %Event{
             status: :retrying,
             attempts: 1,
             last_error_code: "cloudflare_rate_limited",
             locked_at: nil,
             locked_by: nil,
             available_at: available_at
           } = Repo.get!(Event, event.id)

    assert DateTime.diff(available_at, before, :second) in 9..11
    Req.Test.verify!(__MODULE__)
  end

  test "accepts the HTTP-date form of Retry-After" do
    retry_at = DateTime.utc_now() |> DateTime.add(30, :second)
    header = Calendar.strftime(retry_at, "%a, %d %b %Y %H:%M:%S GMT")

    Req.Test.expect(__MODULE__, fn conn ->
      conn
      |> Plug.Conn.put_resp_header("retry-after", header)
      |> Plug.Conn.put_resp_header("content-type", "application/json")
      |> Plug.Conn.resp(429, ~s({"success":false}))
    end)

    assert {:error, {:cloudflare_rate_limited, seconds}} = Cloudflare.purge(["community[home]"])
    assert seconds in 25..35
    Req.Test.verify!(__MODULE__)
  end
end
