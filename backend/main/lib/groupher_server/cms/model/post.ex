defmodule GroupherServer.CMS.Model.Post do
  @moduledoc """
  Ecto schema for post artiments.

  Posts are the default discussion thread and share the CMS article workflow:
  author, community join, tags, reactions, comments, and publish state.
  """

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
    |> validate_enum_atom_attr(attrs, :cat)
    |> validate_enum_atom_attr(attrs, :status)
    |> validate_required(@required_fields)
    |> cast_embed(:meta, required: false, with: &Embeds.ArticleMeta.changeset/2)
    |> geneal_changeset()
  end

  @doc false
  def update_changeset(%Post{} = post, attrs) do
    post
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_enum_atom_attr(attrs, :cat)
    |> validate_enum_atom_attr(attrs, :status)
    |> geneal_changeset()
  end

  defp geneal_changeset(changeset) do
    changeset
    |> validate_length(:title, min: 3, max: 100)
    |> cast_embed(:emotions, with: &Embeds.ArticleEmotion.changeset/2)
    |> validate_length(:link_addr, min: 5, max: 400)
  end

  # Absinthe enum inputs reach CMS as atoms. Do not accept raw string enum
  # values here; otherwise Ecto.Enum would silently cast them back to atoms.
  defp validate_enum_atom_attr(changeset, attrs, field) when is_map(attrs) do
    cond do
      Map.has_key?(attrs, Atom.to_string(field)) ->
        add_error(changeset, field, "must be an enum atom")

      Map.has_key?(attrs, field) ->
        validate_enum_atom_value(changeset, field, Map.get(attrs, field))

      true ->
        changeset
    end
  end

  defp validate_enum_atom_attr(changeset, _attrs, _field), do: changeset

  defp validate_enum_atom_value(changeset, _field, nil), do: changeset

  defp validate_enum_atom_value(changeset, _field, value) when is_atom(value), do: changeset

  defp validate_enum_atom_value(changeset, field, _value),
    do: add_error(changeset, field, "must be an enum atom")
end
