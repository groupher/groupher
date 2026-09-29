defmodule GroupherServer.PublicCache.Const do
  @moduledoc """
  Closed PublicCache invalidation and delivery vocabulary.

  Business position:

      domain and worker code -> PublicCache.Const -> persisted protocol values
  """

  @invalidation_types [
    :article_published,
    :article_content_changed,
    :article_visibility_changed,
    :comments_content_changed,
    :community_presentation_changed,
    :taxonomy_changed,
    :doc_tree_changed
  ]

  @statuses [:pending, :delivering, :delivered, :dead]

  @doc "Returns all supported domain invalidation types."
  def invalidation_types, do: @invalidation_types

  @doc "Returns all persisted delivery states."
  def statuses, do: @statuses

  for type <- @invalidation_types do
    def unquote(type)(), do: unquote(type)
  end
end
