defmodule GroupherServer.CMS.Model.Post do
  @moduledoc """
  Ecto schema for post artiments.

  Posts are the default discussion thread and share the CMS article workflow:
  author, community join, tags, reactions, comments, and publish state.

  Business position:

      CMS context
        -> Post schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
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

  require CMS.Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(article_hash_id title digest)a
  @article_cast_fields general_article_cast_fields() ++ article_version_cast_fields()

  @optional_fields ~w(
    copy_right solution_digest updated_at inserted_at active_at
    cat status inner_id
  )a ++ @article_cast_fields

  @type t :: %Post{}

  schema "posts" do
    article_version_fields()
    field(:copy_right, :string)

    # DB stores string, Ecto exposes atoms
    field(:cat, Ecto.Enum, values: Enums.cat_values())
    field(:status, Ecto.Enum, values: Enums.status_values())

    field(:solution_digest, :string)

    article_tags_field(:post)
    article_communities_field(:post)
    general_article_fields(:post)
  end

  @doc "Returns the Post fields copied by Draft and Publish."
  @spec version_fields() :: [atom()]
  def version_fields do
    ~w(title digest link_addr copy_right cat status solution_digest cover_url cover_url_dark)a
  end

  @doc "Builds a Post changeset for creation."
  def changeset(%Post{} = post, attrs) do
    post
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_enum_atom_attr(attrs, :cat)
    |> validate_enum_atom_attr(attrs, :status)
    |> validate_required(@required_fields)
    |> cast_embed(:meta, required: false, with: &Embeds.ArticleMeta.changeset/2)
    |> geneal_changeset()
  end

  @doc "Builds a Post changeset for mutable field updates."
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
    |> validate_article_version_scope(:post)
    |> unique_constraint(:article_hash_id, name: :posts_community_article_hash_stage_index)
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
