defmodule GroupherServer.CMS.Model.PinnedArticle do
  @moduledoc """
  Ecto schema for pinned article records.

  The row marks a concrete artiment thread item as pinned without moving or
  duplicating the source article.

  Business position:

      CMS context
        -> PinnedArticle schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias __MODULE__

  use Ecto.Schema

  import Ecto.Changeset
  import GroupherServer.CMS.Helper.Macros
  import GroupherServer.CMS.Helper.Constraints, only: [articles_foreign_key_constraint: 1]

  alias GroupherServer.CMS.Artiment.Threads
  alias GroupherServer.CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @threads GroupherServer.CMS.Artiment.Config.threads()

  @required_fields ~w(community_id thread)a
  # @optional_fields ~w(post_id job_id repo_id)a
  @article_fields @threads |> Enum.map(&:"#{&1}_id")

  @type t :: %PinnedArticle{}
  schema "pinned_articles" do
    belongs_to(:community, Community, foreign_key: :community_id)
    field(:thread, Ecto.Enum, values: Threads.article_enums())

    article_belongs_to_fields()
    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%PinnedArticle{} = pinned_article, attrs) do
    pinned_article
    |> cast(attrs, @article_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:community_id)
    |> articles_foreign_key_constraint
  end
end
