defmodule GroupherServer.CMS.Model.ArticleBindingTag do
  @moduledoc """
  Assigns one Community-local tag to an ArticleBinding.

      ArticleBinding(article, community) + CommunityTag
        -> community-specific Article presentation

  These tags are operational Community metadata and never become immutable
  Revision content tags.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{ArticleBinding, CommunityTag}
  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_binding_id tag_id)a

  @type t :: %__MODULE__{}

  schema "article_binding_tags" do
    belongs_to(:article_binding, ArticleBinding, primary_key: true)
    belongs_to(:tag, CommunityTag, primary_key: true)
  end

  @doc "Builds one Community-local tag assignment for an ArticleBinding."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = binding_tag, attrs) do
    binding_tag
    |> cast(attrs, @required_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:article_binding_id)
    |> foreign_key_constraint(:tag_id)
    |> unique_constraint([:article_binding_id, :tag_id], name: :article_binding_tags_pkey)
  end
end
