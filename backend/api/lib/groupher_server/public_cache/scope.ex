defmodule GroupherServer.PublicCache.Scope do
  @moduledoc """
  Resolves typed invalidations into canonical Cloudflare tags.

  Business position:

      invalidation row -> Scope -> canonical tag scope for one purge
  """

  alias GroupherServer.PublicCache
  alias PublicCache.Tags

  @spec tags(atom(), map()) :: {:ok, [String.t()]} | {:error, atom()}
  def tags(type, payload), do: Tags.for_invalidation(type, payload)
end
