defmodule GroupherServer.CMS.Model.ArticleSnapshot do
  @moduledoc """
  Ecto schema for complete immutable Article content captured from a saved WorkingCopy revision.

      Snapshotter -> ArticleSnapshot changeset -> immutable Article content row
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Article, ArticleBody, CoverEditSnapshot}
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id source_working_copy_id source_revision title digest captured_by_id captured_at
                      causation_command_id)a
  @optional_fields ~w(slug cover_edit_snapshot_id)a

  schema "article_snapshots" do
    belongs_to(:article, Article)
    belongs_to(:body, ArticleBody, on_replace: :update)
    field(:source_working_copy_id, Ecto.UUID)
    field(:source_revision, :integer)
    field(:title, :string)
    field(:digest, :string)
    field(:slug, :string)
    belongs_to(:cover_edit_snapshot, CoverEditSnapshot)
    belongs_to(:captured_by, User, type: :id)
    field(:captured_at, :utc_datetime)
    field(:causation_command_id, Ecto.UUID)
    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(%__MODULE__{} = snapshot, attrs) do
    snapshot
    |> cast(attrs, @required_fields ++ @optional_fields, empty_values: [])
    |> validate_required(@required_fields)
    |> validate_number(:source_revision, greater_than: 0)
    |> cast_assoc(:body, required: true)
    |> foreign_key_constraint(:body_id, name: :article_snapshots_body_owner_fkey)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:captured_by_id)
    |> foreign_key_constraint(:cover_edit_snapshot_id)
    |> unique_constraint([:source_working_copy_id, :source_revision])
  end
end
