defmodule GroupherServer.CMS.Model.ArticleWorkingCopyBlog do
  @moduledoc """
  Stores mutable Blog-specific fields as a typed child of ArticleWorkingCopy.

      saveWorkingCopy patch -> Blog field changeset -> ArticleWorkingCopyBlog row
  """
  use Ecto.Schema
  import Ecto.Changeset
  alias GroupherServer.CMS
  alias CMS.Model.ArticleWorkingCopy
  alias Helper.Constant.DBPrefix
  @primary_key false
  @schema_prefix DBPrefix.cms()
  schema "article_working_copy_blogs" do
    belongs_to(:working_copy, ArticleWorkingCopy, type: Ecto.UUID, primary_key: true)
    field(:copy_right, :string)
    field(:link_addr, :string)
    field(:cover_url, :string)
    field(:cover_url_dark, :string)
    timestamps(type: :utc_datetime)
  end

  def changeset(row, attrs) do
      cast(row, attrs, [:working_copy_id, :copy_right, :link_addr, :cover_url, :cover_url_dark])
      |> validate_required([:working_copy_id])
      |> foreign_key_constraint(:working_copy_id)
  end
end
