defmodule GroupherServer.CMS.Articles.ArticleResult do
  @moduledoc """
  Typed boundary for the assembled Article projection.

      Article aggregate + immutable revision
          -> projection assembler
          -> ArticleResult DTO
          -> transport / GraphQL

  The projection is intentionally a DTO rather than an Ecto schema.  Its
  immutable content is anchored by `revision_id` and `body_hash`; operational
  fields remain explicit on the same transport object for compatibility with
  existing GraphQL resolvers.  Extension fields are preserved as map keys so
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
    :community_id,
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
  def fetch(result, key), do: Map.fetch(result, key)

  @doc false
  def get_and_update(result, key, fun), do: Map.get_and_update(result, key, fun)

  @doc false
  def pop(result, key), do: Map.pop(result, key)

  @doc "Marks one assembled projection as the canonical ArticleResult DTO."
  @spec from_map(map()) :: t()
  def from_map(%{} = projection), do: Map.put(projection, :__struct__, __MODULE__)
end
