defmodule GroupherServer.CMS.Model.ArticleWorkingCopyDoc do
  @moduledoc """
  Stores mutable Doc-specific fields as a typed child of ArticleWorkingCopy.

      saveWorkingCopy patch -> Doc field changeset -> ArticleWorkingCopyDoc row
  """
  use Ecto.Schema
  import Ecto.Changeset
  alias GroupherServer.CMS
  alias CMS.Model.ArticleWorkingCopy
  alias Helper.Constant.DBPrefix
  @primary_key false
  @schema_prefix DBPrefix.cms()
  schema "article_working_copy_docs" do
    belongs_to(:working_copy, ArticleWorkingCopy, type: Ecto.UUID, primary_key: true)
    field(:subtitle, :string)
    field(:link_addr, :string)
    field(:template_key, :string)
    field(:cover_url, :string)
    field(:cover_url_dark, :string)
    timestamps(type: :utc_datetime)
  end

  def changeset(row, attrs) do
      cast(row, attrs, [
        :working_copy_id,
        :subtitle,
        :link_addr,
        :template_key,
        :cover_url,
        :cover_url_dark
      ])
      |> validate_required([:working_copy_id])
      |> foreign_key_constraint(:working_copy_id)
  end
end
