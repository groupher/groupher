defmodule GroupherServer.CMS.Model.ArticleWorkingCopy do
  @moduledoc """
  Ecto schema for one mutable complete content owner with its own concurrency revision.

      Article + scope -> ArticleWorkingCopy row -> Store save / Snapshotter freeze
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{Article, CoverEditWorkingCopy}
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id scope_kind scope_id revision title digest body_json
                      body_schema_version body_markdown body_html body_markdown_toc
                      body_plain_text body_thumbnail created_by_id updated_by_id)a
  @optional_fields ~w(slug body_xml body_rss cover_edit_working_copy_id)a
  @type t :: %__MODULE__{}

  schema "article_working_copies" do
    belongs_to(:article, Article)
    field(:scope_kind, Ecto.Enum, values: [:default, :workspace])
    field(:scope_id, Ecto.UUID)
    field(:revision, :integer, default: 1)
    field(:title, :string, default: "")
    field(:digest, :string, default: "")
    field(:slug, :string)
    field(:body_json, :string)
    field(:body_schema_version, :integer, default: 1)
    field(:body_markdown, :string, default: "")
    field(:body_html, :string, default: "")
    field(:body_markdown_toc, :map, default: %{})
    field(:body_plain_text, :string, default: "")
    field(:body_thumbnail, :map, default: %{})
    field(:body_xml, :string)
    field(:body_rss, :string)
    belongs_to(:cover_edit_working_copy, CoverEditWorkingCopy)
    belongs_to(:created_by, User, type: :id)
    belongs_to(:updated_by, User, type: :id)
    timestamps(type: :utc_datetime)
  end

  def changeset(%__MODULE__{} = work, attrs) do
    work
    |> cast(attrs, @required_fields ++ @optional_fields, empty_values: [])
    |> validate_required(@required_fields)
    |> validate_number(:revision, greater_than: 0)
    |> validate_number(:body_schema_version, greater_than: 0)
    |> validate_scope()
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:created_by_id)
    |> foreign_key_constraint(:updated_by_id)
    |> unique_constraint([:article_id, :scope_kind, :scope_id])
  end

  defp validate_scope(changeset) do
    if get_field(changeset, :scope_kind) == :default and
         get_field(changeset, :scope_id) != get_field(changeset, :article_id) do
      add_error(changeset, :scope_id, "must equal article_id for the default workspace")
    else
      changeset
    end
  end
end
