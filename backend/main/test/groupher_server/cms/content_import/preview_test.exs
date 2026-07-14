defmodule GroupherServer.CMS.ContentImport.PreviewTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Preview
  alias GroupherServer.CMS.ContentImport.Preview.Item
  alias GroupherServer.CMS.ContentImport.Threads.Changelog
  alias GroupherServer.CMS.ContentImport.Threads.Doc

  test "rejects an item preview whose schema does not match the selected thread" do
    doc_payload = %Doc.PreviewPayload{source: %{}, target: %{}, tree: %{}}

    changelog_item = %Item{
      external_ref: "release:1",
      target_ref: "article:1",
      action: :create,
      payload: %Changelog.ItemPreview{prerelease: false, content_status: "normalized"}
    }

    assert {:error, %{code: "invalid_thread_preview"}} =
             Preview.new(:doc, 1, doc_payload, [changelog_item])
  end
end
