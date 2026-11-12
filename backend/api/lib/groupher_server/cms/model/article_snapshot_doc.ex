defmodule GroupherServer.CMS.Model.ArticleSnapshotDoc do
  @moduledoc """
  Stores immutable Doc-specific fields as a typed child of ArticleSnapshot.

      Doc WorkingCopy fields -> Snapshotter -> ArticleSnapshotDoc row
  """
  use Ecto.Schema
  import Ecto.Changeset
  alias GroupherServer.CMS
  alias CMS.Model.ArticleSnapshot
  alias Helper.Constant.DBPrefix
  @primary_key false
  @schema_prefix DBPrefix.cms()
  schema "article_snapshot_docs" do
    belongs_to(:snapshot, ArticleSnapshot, type: Ecto.UUID, primary_key: true)
    field(:subtitle, :string)
    field(:link_addr, :string)
    field(:template_key, :string)
    field(:cover_url, :string)
    field(:cover_url_dark, :string)
    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(row, attrs) do
      cast(row, attrs, [
        :snapshot_id,
        :subtitle,
        :link_addr,
        :template_key,
        :cover_url,
        :cover_url_dark
      ])
      |> validate_required([:snapshot_id])
      |> foreign_key_constraint(:snapshot_id)
  end
end
