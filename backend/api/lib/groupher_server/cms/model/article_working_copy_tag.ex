defmodule GroupherServer.CMS.Model.ArticleWorkingCopyTag do
  @moduledoc """
  Join schema for community tags selected by one Article WorkingCopy.

      WorkingCopy tag IDs -> WorkingCopy tag join rows -> mutable tag selection
  """
  use Ecto.Schema
  import Ecto.Changeset
  alias GroupherServer.CMS
  alias CMS.Model.{ArticleWorkingCopy, CommunityTag}
  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()

  schema "article_working_copy_tags" do
    belongs_to(:working_copy, ArticleWorkingCopy, type: Ecto.UUID, primary_key: true)
    belongs_to(:tag, CommunityTag, primary_key: true)
  end

  def changeset(%__MODULE__{} = assignment, attrs) do
    assignment
    |> cast(attrs, [:working_copy_id, :tag_id])
    |> validate_required([:working_copy_id, :tag_id])
    |> foreign_key_constraint(:working_copy_id)
    |> foreign_key_constraint(:tag_id)
  end
end
