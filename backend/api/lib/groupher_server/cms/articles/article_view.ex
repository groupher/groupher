defmodule GroupherServer.CMS.Articles.ArticleView do
  @moduledoc """
  Typed boundary for the assembled public Article view.

      Article aggregate + immutable revision
          -> projection assembler
          -> ArticleView DTO
          -> transport / GraphQL

  The view is intentionally a DTO rather than an Ecto schema. Its immutable
  content is anchored by `revision_id` and `body_hash`; operational fields
  remain explicit on the same transport object for compatibility with existing
  GraphQL resolvers. Extension fields are preserved as map keys so
  thread-specific cover fields do not get dropped during assembly.
  """

  @typedoc "Canonical Article transport projection."
  @type t :: %__MODULE__{}

  @fields [
    :id,
    :article_id,
    :branch_id,
    :inner_id,
    :thread,
    :stage,
    :title,
    :digest,
    :slug,
    :body_hash,
    :document,
    :author_id,
    :author,
    :community,
    :communities,
    :community_tags,
    :comments_participants,
    :moderation_state,
    :active_at,
    :inserted_at,
    :updated_at,
    :revision_id,
    :publication_version,
    :version,
    :lifecycle,
    :is_pinned,
    :pending,
    :viewer_has_collected,
    :viewer_has_upvoted,
    :viewer_has_reported,
    :viewer_has_viewed,
    :meta
  ]

  defstruct @fields

  @doc false
  def fetch(view, key), do: Map.fetch(view, key)

  @doc false
  def get_and_update(view, key, fun), do: Map.get_and_update(view, key, fun)

  @doc false
  def pop(view, key), do: Map.pop(view, key)

  @doc "Marks one assembled projection as the canonical ArticleView DTO."
  @spec from_map(map()) :: t()
  def from_map(%{} = projection), do: Map.put(projection, :__struct__, __MODULE__)
end
