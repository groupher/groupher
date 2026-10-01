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

  use Ecto.Schema

  import Ecto.Changeset

  alias __MODULE__
  alias GroupherServer.CMS
  alias CMS.Artiment.Threads
  alias CMS.Model.{ArticleCommunity, Community}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @required_fields ~w(community_id thread article_community_id)a

  @type t :: %PinnedArticle{}
  schema "pinned_articles" do
    belongs_to(:community, Community, foreign_key: :community_id)
    belongs_to(:article_community, ArticleCommunity)
    field(:thread, Ecto.Enum, values: Threads.article_enums())

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%PinnedArticle{} = pinned_article, attrs) do
    pinned_article
    |> cast(attrs, @required_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:article_community_id)
    |> unique_constraint(:article_community_id)
  end
end
