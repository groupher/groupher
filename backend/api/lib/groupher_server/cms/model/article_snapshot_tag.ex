defmodule GroupherServer.CMS.Model.ArticleSnapshotTag do
  @moduledoc """
  Join schema for community tags selected by one immutable ArticleSnapshot.

      Snapshot tag IDs -> snapshot tag join rows -> immutable tag selection
  """
  use Ecto.Schema
  import Ecto.Changeset
  alias GroupherServer.CMS
  alias CMS.Model.{ArticleSnapshot, CommunityTag}
  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()

  schema "article_snapshot_tags" do
    belongs_to(:snapshot, ArticleSnapshot, type: Ecto.UUID, primary_key: true)
    belongs_to(:tag, CommunityTag, primary_key: true)
  end

  def changeset(%__MODULE__{} = assignment, attrs) do
    assignment
    |> cast(attrs, [:snapshot_id, :tag_id])
    |> validate_required([:snapshot_id, :tag_id])
    |> foreign_key_constraint(:snapshot_id)
    |> foreign_key_constraint(:tag_id)
  end
end
