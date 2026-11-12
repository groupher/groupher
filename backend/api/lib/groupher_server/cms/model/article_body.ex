defmodule GroupherServer.CMS.Model.ArticleBody do
  @moduledoc """
  Stores the complete body owned exclusively by one WorkingCopy or Snapshot.

      trusted BodyBag -> mutable ArticleBody -> independent immutable ArticleBody
  """
  use Ecto.Schema
  import Ecto.Changeset
  import GroupherServer.CMS.Model.ArticleBodyDocument, only: [body_document_fields: 0]

  alias GroupherServer.CMS
  alias CMS.Model.{Article, ArticleBodyDocument}
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()

  schema "article_bodies" do
    belongs_to(:article, Article)
    field(:type, Ecto.Enum, values: [:working_copy, :snapshot])
    body_document_fields()
    timestamps(type: :utc_datetime)
  end

  @doc "Validates a complete document; database guards also enforce ownership and immutability."
  def changeset(body, attrs) do
    body
    |> ArticleBodyDocument.changeset(attrs, [:article_id, :type])
    |> foreign_key_constraint(:article_id)
  end
end
