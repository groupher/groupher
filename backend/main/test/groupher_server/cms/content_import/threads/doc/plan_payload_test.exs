defmodule GroupherServer.CMS.ContentImport.Threads.Doc.PlanPayloadTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Threads.Doc.PlanPayload

  test "decodes and encodes the private Doc Plan schema" do
    attrs = %{
      "schemaVersion" => 1,
      "source" => %{"framework" => "nextra"},
      "target" => %{"thread" => "doc"},
      "tree" => %{"tabs" => []}
    }

    assert {:ok, payload} = PlanPayload.new(attrs)
    assert payload.schema_version == 1
    assert PlanPayload.encode(payload) == attrs
  end
end
