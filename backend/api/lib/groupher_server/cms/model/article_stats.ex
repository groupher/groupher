defmodule GroupherServer.CMS.Model.ArticleStats do
  @moduledoc """
  Public aggregate read model for a physical Article.

  The owning domains write only their fields. This row is the single public
  read model; public GraphQL never reconstructs counts from owner tables.

  ```text
  Domain owner transaction
    -> one field-scoped CMS.ArticleStats API
    -> cms.article_stats persisted snapshot
    -> GraphQL / SSR / TanStack Query public reads
  ```
  """

  use Ecto.Schema

  alias GroupherServer.CMS
  alias CMS.Artiment.Threads
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  schema "article_stats" do
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:article_id, :id)
    field(:views, :integer, default: 0)
    field(:views_revision, :integer, default: 0)
    field(:upvotes_count, :integer, default: 0)
    field(:comments_count, :integer, default: 0)
    field(:collects_count, :integer, default: 0)
    field(:comments_participants_count, :integer, default: 0)
    field(:interaction_revision, :integer, default: 0)
    field(:comments_revision, :integer, default: 0)
    field(:emotion_counts, {:array, :map}, virtual: true, default: [])
    field(:snapshot_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end
end
