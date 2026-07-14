defmodule GroupherServer.CMS.ContentImport.ApplyResultTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.ApplyResult

  test "requires stable target refs for applied items and assets" do
    assert {:ok, result} =
             ApplyResult.new(%{
               items: [
                 %{external_ref: "docs/start.md", target_ref: "article:1", status: :created}
               ],
               assets: [
                 %{asset_key: "asset_logo", target_ref: "asset:1", status: :reused}
               ]
             })

    assert hd(result.assets).target_ref == "asset:1"

    assert {:error, %{code: "invalid_apply_assets"}} =
             ApplyResult.new(%{
               items: [],
               assets: [%{asset_key: "asset_logo", target_ref: nil, status: :created}]
             })
  end
end
