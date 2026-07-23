defmodule GroupherServer.CMS.ContentImport.ProcessTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Process
  alias GroupherServer.CMS.ContentImport.Persistence.Job

  test "projects bounded, safe process data from persisted job facts" do
    recent_batch =
      Enum.map(1..7, fn index ->
        %{"label" => "docs/page-#{index}.md", "ref" => "page-#{index}", "state" => "completed"}
      end) ++ [%{"label" => nil, "ref" => "invalid", "state" => "unknown"}]

    job = %Job{
      progress: %{
        "bodies" => %{
          "failed" => 1,
          "pending" => 2,
          "ready" => 3,
          "skipped" => 1,
          "total" => 7
        },
        "recentBatch" => recent_batch
      },
      status: :staging,
      updated_at: ~U[2026-07-22 08:00:00Z]
    }

    process = Process.project(job)

    assert process.state == :running
    assert process.stage == :preparing
    assert process.progress == %{completed: 5, total: 7, unit: :document}
    assert length(process.recent_batch) == 5
    assert List.last(process.recent_batch).label == "docs/page-5.md"
  end
end
