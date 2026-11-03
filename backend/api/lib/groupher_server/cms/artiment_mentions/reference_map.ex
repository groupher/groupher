defmodule GroupherServer.CMS.ArtimentMentions.ReferenceMap do
  @moduledoc """
  Owns the public Reference Map facade and Community pending projection.

      GraphQL request -> frontier batch -> pending public source check
  """

  alias GroupherServer.CMS.ArtimentMentions.ReferenceMap.Batch
  alias GroupherServer.CMS.ErrorCat

  def page(community, focus, frontiers, first) do
    Batch.page(community, focus, frontiers, first) |> normalize_result()
  end

  def article_comments(community, focus, after_cursor, first) do
    Batch.article_comments(community, focus, after_cursor, first) |> normalize_result()
  end

  def revision(community, focus) do
    Batch.revision(community, focus) |> normalize_result()
  end

  defdelegate community_pending?(community), to: Batch

  defp normalize_result({:error, "not found"}),
    do: {:error, ErrorCat.reference_map_not_found()}

  defp normalize_result({:error, "invalid locator"}),
    do: {:error, ErrorCat.reference_map_invalid_locator()}

  defp normalize_result({:error, "invalid cursor"}),
    do: {:error, ErrorCat.reference_map_invalid_cursor()}

  defp normalize_result({:error, "duplicate frontier"}),
    do: {:error, ErrorCat.reference_map_duplicate_frontier()}

  defp normalize_result({:error, "invalid reference map request"}),
    do: {:error, ErrorCat.reference_map_invalid_request()}

  defp normalize_result(result), do: result
end
