defmodule GroupherServer.CMS.Model.Category do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Model.{Author, Community, CommunityCategory}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @required_fields ~w(title slug author_id)a
  @optional_fields ~w(index)a

  @type t :: %Category{}

  schema "categories" do
    field(:title, :string)
    field(:slug, :string)
    field(:index, :integer)
    belongs_to(:author, Author)

    many_to_many(
      :communities,
      Community,
      join_through: CommunityCategory,
      join_keys: [category_id: :id, community_id: :id],
      on_delete: :delete_all,
      on_replace: :delete
    )

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%Category{} = category, attrs) do
    category
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    # |> foreign_key_constraint(:community_id)
    # |> foreign_key_constraint(:author_id)
    |> unique_constraint(:title, name: :categories_title_index)
  end

  @doc false
  def update_changeset(%Category{} = category, attrs) do
    category
    |> cast(attrs, @optional_fields ++ @required_fields)
    # |> foreign_key_constraint(:community_id)
    # |> foreign_key_constraint(:author_id)
    |> unique_constraint(:title, name: :categories_title_index)
  end
end
