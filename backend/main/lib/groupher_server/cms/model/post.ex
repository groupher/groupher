defmodule GroupherServer.CMS.Model.Post do
  @moduledoc false

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import GroupherServer.CMS.Helper.Macros

  alias GroupherServer.CMS

  alias CMS.Artiment.Enums
  alias CMS.Model.Embeds
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(title digest)a
  @article_cast_fields general_article_cast_fields()

  @optional_fields ~w(
    copy_right solution_digest updated_at inserted_at active_at archived_at
    cat status inner_id community_slug
  )a ++ @article_cast_fields

  @type t :: %Post{}

  schema "posts" do
    field(:copy_right, :string)

    # DB stores string, Ecto exposes atoms
    field(:cat, Ecto.Enum, values: Enums.cat_values())
    field(:status, Ecto.Enum, values: Enums.status_values())

    field(:solution_digest, :string)

    article_tags_field(:post)
    article_communities_field(:post)
    general_article_fields(:post)
  end

  @doc false
  def changeset(%Post{} = post, attrs) do
    post
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> normalize_enum(:cat, Enums.cat_values())
    |> normalize_enum(:status, Enums.status_values())
    |> validate_required(@required_fields)
    |> cast_embed(:meta, required: false, with: &Embeds.ArticleMeta.changeset/2)
    |> geneal_changeset()
  end

  @doc false
  def update_changeset(%Post{} = post, attrs) do
    post
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> normalize_enum(:cat, Enums.cat_values())
    |> normalize_enum(:status, Enums.status_values())
    |> geneal_changeset()
  end

  defp geneal_changeset(changeset) do
    changeset
    |> validate_length(:title, min: 3, max: 100)
    |> cast_embed(:emotions, with: &Embeds.ArticleEmotion.changeset/2)
    |> validate_length(:link_addr, min: 5, max: 400)
  end

  # Accept:
  # - atom: :todo
  #
  # Reject any other value with a changeset error.
  defp normalize_enum(changeset, field, allowed_atoms) do
    case fetch_change(changeset, field) do
      :error ->
        changeset

      {:ok, nil} ->
        changeset

      {:ok, v} when is_atom(v) ->
        if v in allowed_atoms do
          changeset
        else
          add_error(changeset, field, "invalid value")
        end

      {:ok, _other} ->
        add_error(changeset, field, "invalid value")
    end
  end
end
