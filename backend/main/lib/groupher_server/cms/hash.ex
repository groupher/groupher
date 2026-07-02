defmodule GroupherServer.CMS.Hash do
  @moduledoc """
  Shared content hash helpers for CMS publish/change detection.
  """

  @article_snapshot_content_algorithm :sha256

  @doc """
  Returns the content hash shape persisted by `ArticleSnapshot`.
  """
  @spec article_snapshot_content_hash(String.t() | nil, String.t() | nil) :: String.t()
  def article_snapshot_content_hash(content_hash, subtitle) do
    @article_snapshot_content_algorithm
    |> :crypto.hash(:erlang.term_to_binary({content_hash, subtitle}))
    |> Base.encode16(case: :lower)
  end
end
