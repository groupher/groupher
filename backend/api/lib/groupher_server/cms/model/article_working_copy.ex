defmodule GroupherServer.CMS.Model.ArticleWorkingCopy do
  @moduledoc """
  Ecto schema for one mutable complete content owner with its own concurrency revision.

      Article + scope -> ArticleWorkingCopy row -> Store save / Snapshotter freeze
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Article, ArticleBody, CoverEditWorkingCopy}
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id scope_type scope_id revision title digest created_by_id updated_by_id)a
  @optional_fields ~w(slug cover_edit_working_copy_id)a
  @type t :: %__MODULE__{}

  schema "article_working_copies" do
    belongs_to(:article, Article)
    belongs_to(:body, ArticleBody, on_replace: :update)
    field(:scope_type, Ecto.Enum, values: [:default, :workspace])
    field(:scope_id, Ecto.UUID)
    field(:revision, :integer, default: 1)
    field(:title, :string, default: "")
    field(:digest, :string, default: "")
    field(:slug, :string)
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
    |> cast_assoc(:body, required: true)
    |> foreign_key_constraint(:body_id, name: :article_working_copys_body_owner_fkey)
    |> validate_scope()
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:created_by_id)
    |> foreign_key_constraint(:updated_by_id)
    |> unique_constraint([:article_id, :scope_type, :scope_id])
  end

  defp validate_scope(changeset) do
    if get_field(changeset, :scope_type) == :default and
         get_field(changeset, :scope_id) != get_field(changeset, :article_id) do
      add_error(changeset, :scope_id, "must equal article_id for the default workspace")
    else
      changeset
    end
  end
end
