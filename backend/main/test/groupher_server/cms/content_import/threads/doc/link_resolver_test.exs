defmodule GroupherServer.CMS.ContentImport.Threads.Doc.LinkResolverTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Entry
  alias GroupherServer.CMS.ContentImport.Threads.Doc.LinkResolver

  test "rewrites relative, extensionless and absolute page links while preserving suffixes" do
    resolver =
      LinkResolver.new([
        %{"sourceId" => "docs/guide/start.md", "route" => "/guide/start"},
        %{"sourceId" => "docs/api/client.md", "route" => "/api/client"},
        %{"sourceId" => "docs/reference/index.mdx", "route" => "/reference"}
      ])

    source = entry("docs/guide/start.md")

    assert resolver.("../api/client.md#auth", source) == {:ok, "/api/client#auth"}
    assert resolver.("../reference?tab=all", source) == {:ok, "/reference?tab=all"}
    assert resolver.("/api/client/", source) == {:ok, "/api/client"}
  end

  test "keeps external, in-page, unresolved and escaping links unchanged" do
    resolver =
      LinkResolver.new([
        %{"sourceId" => "docs/guide/start.md", "route" => "/guide/start"}
      ])

    source = entry("docs/guide/start.md")

    assert resolver.("https://example.com/docs", source) == :keep
    assert resolver.("mailto:docs@example.com", source) == :keep
    assert resolver.("#local-heading", source) == :keep
    assert resolver.("./missing.md", source) == :keep
    assert resolver.("../../../outside.md", source) == :keep
  end

  defp entry(path) do
    Entry.new!(%{external_ref: path, kind: :file, path: path, body: "body", body_format: :md})
  end
end
