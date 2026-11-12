defmodule GroupherServer.CMS.DocTree.Publish.ContentMergeTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.ContentMerge

  defp content do
    %{
      title: "Title",
      digest: "",
      slug: nil,
      subtitle: nil,
      link_addr: nil,
      template_key: nil,
      cover_url: nil,
      cover_url_dark: nil,
      body: %{
        json: ~s([{"id":"a","type":"p","children":[{"text":"A"}]}]),
        schema_version: 1,
        markdown: "A",
        html: "<p>A</p>",
        markdown_toc: %{},
        plain_text: "A",
        thumbnail: %{},
        xml: nil,
        rss: nil
      },
      tags: [2, 1],
      asset_refs: [],
      cover_refs: [],
      cover_edit: %{
        id: "original",
        format_version: 1,
        canvas_width: 100,
        canvas_height: 50,
        light: %{"layers" => []},
        dark: %{"layers" => []}
      }
    }
  end

  test "merges independent fields and preserves the complete selected body" do
    base = content()
    source = %{base | title: "Source"}
    body = %{base.body | json: ~s([{"id":"b"}]), html: "target html"}
    target = %{base | body: body}

    assert {:ok, %{fields: fields, origins: origins}} = ContentMerge.merge(base, source, target)
    assert fields.title == "Source"
    assert fields.body == body
    assert origins.title == :source
    assert origins.body == :target
  end

  test "reports all divergent fields and accepts explicit choices only for conflicts" do
    base = content()
    source = %{base | title: "Source", digest: "source digest"}
    target = %{base | title: "Target", digest: "target digest"}

    assert {:error, {:merge_conflict, [:title, :digest]}} =
             ContentMerge.merge(base, source, target)

    assert {:ok, %{fields: %{title: "Source", digest: "target digest"}}} =
             ContentMerge.merge(base, source, target, choices: %{title: :source, digest: :target})

    assert {:error, :invalid_conflict_choice} =
             ContentMerge.merge(base, source, target, choices: %{slug: :source})
  end

  test "ignores key order, derived body output, tag order and cover row identity" do
    base = content()

    changed = %{
      base
      | body: %{
          base.body
          | json: ~s([{"children":[{"text":"A"}],"type":"p","id":"a"}]),
            html: "different derived output"
        },
        tags: [1, 2],
        cover_edit: %{base.cover_edit | id: "another"}
    }

    assert {:ok, %{fields: fields}} = ContentMerge.merge(base, changed, base)
    assert fields.body == base.body
    assert {:ok, []} = ContentMerge.exclusive_changes(base, changed, base)

    assert {:ok, %{fields: fast_forward}} =
             ContentMerge.merge(base, changed, base, mode: :fast_forward)

    assert fast_forward.body == changed.body
  end

  test "body array order and schema version are semantic changes" do
    base = content()
    queue = %{base | body: %{base.body | schema_version: 2}}
    assert {:ok, [:body]} = ContentMerge.exclusive_changes(base, queue, base)
    assert {:ok, []} = ContentMerge.exclusive_changes(base, queue, queue)

    source = %{base | body: %{base.body | json: ~s([{"id":"a"},{"id":"b"}])}}
    target = %{base | body: %{base.body | json: ~s([{"id":"b"},{"id":"a"}])}}
    assert {:error, {:merge_conflict, [:body]}} = ContentMerge.merge(base, source, target)
  end

  test "only Q changes absent from D require discard confirmation" do
    base = content()
    queue = %{base | title: "Shared", subtitle: "Q only"}
    default = %{base | title: "Shared", digest: "D only"}

    assert {:ok, [:subtitle]} = ContentMerge.exclusive_changes(base, queue, default)
    assert {:ok, []} = ContentMerge.exclusive_changes(base, base, default)
  end

  test "empty and null fields stay distinct and a changed canvas conflicts" do
    base = content()
    source = %{base | subtitle: "", cover_edit: %{base.cover_edit | canvas_width: 120}}
    target = %{base | subtitle: "other", cover_edit: %{base.cover_edit | canvas_width: 140}}

    assert {:error, {:merge_conflict, [:subtitle, :cover_edit]}} =
             ContentMerge.merge(base, source, target)
  end

  test "independently edited asset references participate in merge and discard checks" do
    base = content()

    ref = %{
      asset_id: "asset-1",
      usage: :attachment,
      position: 0,
      block_id: "a",
      block_type: "image",
      alt: nil,
      title: nil,
      source: nil,
      meta: %{}
    }

    queue = %{base | asset_refs: [ref]}
    default = %{base | asset_refs: [%{ref | alt: "changed"}]}

    assert {:ok, [:asset_refs]} = ContentMerge.exclusive_changes(base, queue, default)
    assert {:error, {:merge_conflict, [:asset_refs]}} = ContentMerge.merge(base, queue, default)

    assert {:ok, [:asset_refs]} =
             ContentMerge.exclusive_changes(
               queue,
               %{queue | asset_refs: [%{ref | meta: %{"x" => 1}}]},
               queue
             )
  end

  test "cover asset selections participate in merge and discard checks" do
    base = content()

    ref = %{
      asset_id: 42,
      usage: :cover,
      position: 0,
      block_id: nil,
      block_type: nil,
      alt: nil,
      title: nil,
      source: nil,
      meta: %{}
    }

    queue = %{base | cover_refs: [ref]}
    assert {:ok, [:cover_url]} = ContentMerge.exclusive_changes(base, queue, base)
    assert {:ok, []} = ContentMerge.exclusive_changes(base, queue, queue)

    assert {:error, {:merge_conflict, [:cover_url]}} =
             ContentMerge.merge(base, queue, %{base | cover_refs: [%{ref | asset_id: 43}]})

    assert {:error, {:merge_conflict, [:cover_url]}} =
             ContentMerge.merge(base, queue, %{base | cover_url: "https://example.test/other"})

    dark = %{ref | asset_id: 43, usage: :cover_dark}
    dark_target = %{base | cover_url_dark: "https://example.test/dark", cover_refs: [dark]}
    assert {:ok, %{fields: merged}} = ContentMerge.merge(base, queue, dark_target)
    assert merged.cover_url == queue.cover_url
    assert merged.cover_url_dark == dark_target.cover_url_dark
    assert merged.cover_refs == [ref, dark]
  end

  test "rejects incomplete content and a fast forward with an edited target" do
    base = content()

    assert {:error, :invalid_doc_content} =
             ContentMerge.merge(Map.delete(base, :slug), base, base)

    assert {:error, :invalid_body_document} =
             ContentMerge.merge(base, %{base | body: Map.delete(base.body, :html)}, base)

    assert {:error, :invalid_fast_forward} =
             ContentMerge.merge(base, base, %{base | title: "edited"}, mode: :fast_forward)
  end

  test "uses canonical JSON for cover values and rejects duplicate body object names" do
    base = content()
    one = %{base | cover_edit: %{base.cover_edit | light: %{"opacity" => 1}}}
    same = %{one | cover_edit: %{one.cover_edit | light: %{"opacity" => 1.0}}}

    assert {:ok, []} = ContentMerge.exclusive_changes(one, same, one)

    duplicate = %{base | body: %{base.body | json: ~s([{"id":"a","id":"b"}])}}
    assert {:error, :invalid_body_document} = ContentMerge.merge(base, duplicate, base)

    invalid_cover = %{base | cover_edit: %{base.cover_edit | light: %{:x => 1, "x" => 2}}}
    assert {:error, :invalid_cover_edit} = ContentMerge.merge(base, invalid_cover, base)
  end
end
