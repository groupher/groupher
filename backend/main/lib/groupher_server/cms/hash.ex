defmodule GroupherServer.CMS.Hash do
  @moduledoc """
  Shared content hash helpers for CMS publish/change detection.
  """

  @article_snapshot_content_algorithm :sha256
  @asset_url_algorithm :sha256

  @doc """
  Returns the content hash shape persisted by `ArticleSnapshot`.

  The input is encoded as an Erlang term before hashing so title/body hash pairs
  remain stable and collision-resistant for publish/change detection.

  ## Examples

      CMS.Hash.article_snapshot_content_hash("body-hash", "subtitle")
      #=> "a stable sha256 hex string"

  """
  @spec article_snapshot_content_hash(String.t() | nil, String.t() | nil) :: String.t()
  def article_snapshot_content_hash(content_hash, subtitle) do
    @article_snapshot_content_algorithm
    |> :crypto.hash(:erlang.term_to_binary({content_hash, subtitle}))
    |> Base.encode16(case: :lower)
  end

  @doc """
  Returns a stable hash for asset URL uniqueness inside a community.

  Community assets store this hash rather than depending on the raw URL for the
  partial unique index used by active asset deduplication.

  ## Examples

      CMS.Hash.asset_url_hash("https://cdn.example/hero.png")
      #=> "a stable sha256 hex string"

  """
  @spec asset_url_hash(String.t()) :: String.t()
  def asset_url_hash(url) when is_binary(url) do
    @asset_url_algorithm
    |> :crypto.hash(url)
    |> Base.encode16(case: :lower)
  end
end
