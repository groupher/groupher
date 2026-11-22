defmodule GroupherServer.CMS.Model.ArticlePublicBody do
  @moduledoc """
  Stores the complete current public body independently of historical ArticleBody rows.

      selected Snapshot -> atomic Public / PublicBody replacement -> public readers
  """
  use Ecto.Schema
  import Ecto.Changeset
  import GroupherServer.CMS.Model.ArticleBodyDocument, only: [body_document_fields: 0]

  alias GroupherServer.CMS
  alias CMS.Model.{ArticleBodyDocument, ArticlePublic, ArticleSnapshot}
  alias Helper.Constant.DBPrefix

  @primary_key false
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()

  schema "article_public_bodies" do
    belongs_to(:public, ArticlePublic,
      foreign_key: :article_id,
      references: :article_id,
      primary_key: true
    )

    belongs_to(:snapshot, ArticleSnapshot)
    body_document_fields()
    timestamps(type: :utc_datetime)
  end

  @doc "Builds a complete public projection; callers must also update Public in the transaction."
  def changeset(body, attrs) do
    body
    |> ArticleBodyDocument.changeset(attrs, [:article_id, :snapshot_id])
    |> foreign_key_constraint(:article_id)
  end
end
