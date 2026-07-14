defmodule GroupherServer.CMS.ContentImport.Threads.Doc.ContentNormalizer do
  @moduledoc """
  Docs-facing wrapper around the shared Markdown normalization pipeline.

  Framework extraction remains Docs-specific, while Markdown/MDX conversion
  and resource discovery are shared with other import threads.
  """

  alias GroupherServer.CMS.ContentImport.MarkdownNormalizer

  defdelegate schema_version(), to: MarkdownNormalizer
  defdelegate normalize(entry, snapshot), to: MarkdownNormalizer
  defdelegate normalize(entry, snapshot, opts), to: MarkdownNormalizer
end
