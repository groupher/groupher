defmodule GroupherServer.CMS.ContentImport.Plan.AssetTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Plan.Asset

  test "entry sources explicitly carry an Entry external_ref" do
    assert {:ok, %Asset{source: {:entry, "asset:logo"}}} =
             Asset.new(%{asset_key: "logo", source: {:entry, "asset:logo"}})

    assert {:error, %{code: "invalid_plan_asset_source"}} =
             Asset.new(%{asset_key: "logo", source: {:blob_sha, "abc123"}})

    assert {:error, %{code: "invalid_plan_asset_source"}} =
             Asset.new(%{asset_key: "logo", source: {:path, "images/logo.png"}})
  end

  test "moves through staging before reaching a terminal status" do
    asset = Asset.new!(%{asset_key: "logo", source: {:entry, "asset:logo"}})

    assert {:ok, staging} = Asset.transition(asset, :staging)

    assert {:ok, ready} =
             Asset.transition(staging, :ready, %{
               content_hash: String.duplicate("a", 64),
               staging_ref: "staging/job/logo"
             })

    assert Asset.terminal?(ready)
    assert {:error, %{code: "invalid_plan_asset_transition"}} = Asset.transition(asset, :ready)
  end

  test "ready assets require both content hash and staging ref" do
    asset =
      Asset.new!(%{asset_key: "logo", source: {:remote_url, "https://example.com/logo.png"}})

    assert {:ok, staging} = Asset.transition(asset, :staging)

    assert {:error, %{code: "incomplete_ready_plan_asset"}} =
             Asset.transition(staging, :ready, %{content_hash: "hash"})
  end
end
