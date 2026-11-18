defmodule GroupherServer.CMS.Model.ArticleCoAuthor do
  @moduledoc """
  Current Article member and its explicitly granted permissions.

      Article command -> Passport Store -> current membership
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Passport.Catalog
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @schema_prefix DBPrefix.cms()
  @type t :: %__MODULE__{}

  schema "article_co_authors" do
    field(:article_id, Ecto.UUID)
    field(:author_id, :integer)
    field(:permissions, :map, default: %{})
    field(:revision, :integer, default: 1)
    field(:joined_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  @doc "Validates current member identity, version and Article permission dependencies."
  def changeset(member, attrs) do
    member
    |> cast(attrs, [:article_id, :author_id, :permissions, :revision, :joined_at])
    |> validate_required([:article_id, :author_id, :permissions, :revision, :joined_at])
    |> validate_number(:revision, greater_than: 0)
    |> validate_permissions()
    |> unique_constraint([:article_id, :author_id])
    |> check_constraint(:author_id, name: :article_co_authors_owner_check)
    |> check_constraint(:revision, name: :article_co_authors_revision_check)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:author_id)
  end

  defp validate_permissions(changeset) do
    case Catalog.validate_permissions(:article, get_field(changeset, :permissions)) do
      {:ok, normalized} -> put_change(changeset, :permissions, normalized)
      {:error, reason} -> add_error(changeset, :permissions, to_string(reason))
    end
  end
end
