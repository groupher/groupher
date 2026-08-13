defmodule GroupherServer.CMS.Hash do
  @moduledoc """
  Shared content hash helpers for CMS publish/change detection.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Hash
        -> Repo / external boundary
  """

  @article_version_algorithm :sha256
  @asset_url_algorithm :sha256

  @doc """
  Hashes the complete canonical version state stored by `ArticleSnapshot`.

  Identity, branch, stage, counters, reactions, and other runtime fields are
  intentionally excluded. Product-specific version fields arrive through
  `data`, while the editor source is represented by the publisher's `body_hash`.
  """
  @spec article_version_hash(struct(), String.t(), map()) :: String.t()
  def article_version_hash(article, body_hash, data)
      when is_struct(article) and is_binary(body_hash) and is_map(data) do
    version = %{
      title: Map.get(article, :title),
      digest: Map.get(article, :digest),
      slug: Map.get(article, :slug),
      subtitle: Map.get(article, :subtitle),
      body_hash: body_hash,
      data: data
    }

    @article_version_algorithm
    |> :crypto.hash(:erlang.term_to_binary(version))
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
