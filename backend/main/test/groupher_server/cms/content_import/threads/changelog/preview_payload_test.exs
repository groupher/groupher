defmodule GroupherServer.CMS.ContentImport.Threads.Changelog.PreviewPayloadTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Threads.Changelog.{PlanPayload, PreviewPayload}

  test "projects only the Changelog preview aggregate" do
    plan_payload =
      PlanPayload.new!(%{
        schema_version: 1,
        source: %{"platform" => "github_releases"},
        target: %{"thread" => "changelog"}
      })

    assert %PreviewPayload{source: source, target: target} =
             PreviewPayload.from_plan_payload(plan_payload)

    assert source == plan_payload.source
    assert target == plan_payload.target
  end
end
