defmodule GroupherServer.CMS.ContentImport.Threads.Changelog.PlanPayloadTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Threads.Changelog.PlanPayload

  test "decodes and encodes the private Changelog Plan schema" do
    attrs = %{
      "schemaVersion" => 1,
      "source" => %{"platform" => "github_releases"},
      "target" => %{"thread" => "changelog"}
    }

    assert {:ok, payload} = PlanPayload.new(attrs)
    assert payload.schema_version == 1
    assert PlanPayload.encode(payload) == attrs
  end
end
