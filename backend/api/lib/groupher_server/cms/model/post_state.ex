defmodule GroupherServer.CMS.Model.PostState do
  @moduledoc """
  Stable Article-global Post classification that does not create content Revisions.

      Post category / moderation -> PostState -> ArticlePublic refresh
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Artiment.Const
  alias CMS.Model.Article
  alias Helper.Constant.DBPrefix

  @primary_key false
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @type t :: %__MODULE__{}

  schema "post_states" do
    belongs_to(:article, Article, primary_key: true)
    field(:cat, Ecto.Enum, values: Const.cat_values())
    timestamps(type: :utc_datetime)
  end

  @doc "Builds an immediate Post classification update outside content versioning."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = state, attrs) do
    state
    |> cast(attrs, [:article_id, :cat])
    |> validate_required([:article_id])
    |> foreign_key_constraint(:article_id)
  end
end
