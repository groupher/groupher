defmodule GroupherServer.CMS.ContentImport.MarkdownNormalizerTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.{Entry, MarkdownNormalizer, Snapshot}
  alias Helper.ContentPipeline

  test "normalizes Markdown through ContentPipeline and emits pending asset placeholders" do
    body = """
    ---
    title: Imported page
    ---
    # Hello

    Read **carefully** and visit [Groupher](https://groupher.com).

    ![Local logo](./images/logo.png)
    ![Remote logo](https://cdn.example.com/logo.webp)
    """

    page =
      Entry.new!(%{
        external_ref: "docs/start.md",
        kind: :file,
        path: "docs/start.md",
        body: body,
        body_format: :md
      })

    logo =
      Entry.new!(%{
        external_ref: "docs/images/logo.png",
        kind: :asset,
        path: "docs/images/logo.png",
        body: <<0, 1, 2>>,
        metadata: %{mime_type: "image/png"}
      })

    snapshot = snapshot([page, logo])

    assert {:ok, result} = MarkdownNormalizer.normalize(page, snapshot)
    assert result.content["status"] == "normalized"
    assert result.content["schemaVersion"] == 1
    assert length(result.content["assetKeys"]) == 2
    assert length(result.assets) == 2
    assert Enum.all?(result.assets, &(&1.status == :pending))

    assert Enum.any?(result.assets, &(&1.source == {:entry, "docs/images/logo.png"}))

    assert Enum.any?(
             result.assets,
             &(&1.source == {:remote_url, "https://cdn.example.com/logo.webp"})
           )

    assert {:ok, payload} = ContentPipeline.parse(%{body: result.content["body"]})
    assert payload.plain_text =~ "Hello"
    assert payload.plain_text =~ "Local logo"

    assert result.content["body"] =~ "content-import://asset/asset_"
    assert page.body == body
  end

  test "deduplicates repeated assets and retains source context" do
    page =
      Entry.new!(%{
        external_ref: "guide/index.mdx",
        kind: :file,
        path: "guide/index.mdx",
        body: "![one](../shared.png)\n\n![two](../shared.png)",
        body_format: :mdx
      })

    asset =
      Entry.new!(%{
        external_ref: "shared.png",
        kind: :asset,
        path: "shared.png",
        body: "png"
      })

    assert {:ok, result} = MarkdownNormalizer.normalize(page, snapshot([page, asset]))
    assert [planned_asset] = result.assets
    assert planned_asset.source == {:entry, "shared.png"}
    assert Enum.map(planned_asset.references, & &1["sourceUrl"]) == ["../shared.png"]
    assert result.content["assetKeys"] == [planned_asset.asset_key]
  end

  test "reports unsupported MDX and rejected path traversal without silently dropping text" do
    body = "<UnknownCard>Keep this text</UnknownCard>\n\n![escape](../../secret.png)"

    page =
      Entry.new!(%{
        external_ref: "docs/page.mdx",
        kind: :file,
        path: "docs/page.mdx",
        body: body,
        body_format: :mdx
      })

    assert {:ok, result} = MarkdownNormalizer.normalize(page, snapshot([page]))

    assert Enum.any?(result.diagnostics, &(&1.code == "unsupported_mdx_component"))
    assert Enum.any?(result.diagnostics, &(&1.code == "markdown_asset_path_traversal"))
    assert result.content["plainText"] =~ "Keep this text"
    assert result.assets == []
  end

  defp snapshot(entries) do
    Snapshot.new!(%{
      platform: :test,
      source_ref: "fixture:content-normalizer",
      entries: entries,
      fetched_at: ~U[2026-07-14 00:00:00Z]
    })
  end
end
