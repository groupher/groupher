defmodule GroupherServer.CMS.Model.ArticleBinding do
  @moduledoc """
  Stores one Article's binding to one Community.

      stable Article
        -> ArticleBinding(article, community)
        -> community-local identity and binding-owned relations

  Every row is a peer ArticleBinding. Product commands may call an insertion a
  mirror, but the binding itself does not have a home/mirror role.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Model.{Article, Community}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id community_id)a
  @optional_fields ~w(inner_id thread)a

  @type t :: %__MODULE__{}

  schema "article_bindings" do
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:community, Community)
    field(:inner_id, :integer)

    field(:thread, Ecto.Enum,
      values: CMS.Artiment.Threads.identity_values_list(),
      read_after_writes: true
    )

    timestamps(type: :utc_datetime)
  end

  @doc "Builds one peer ArticleBinding for a stable Article."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = binding, attrs) do
    binding
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:community_id)
    |> unique_constraint([:article_id, :community_id])
    |> unique_constraint(:article_id, name: :article_bindings_doc_single_owner_index)
    |> check_constraint(:thread, name: :article_bindings_canonical_thread_check)
    |> check_constraint(:community_id, name: :doc_binding_identity_check)
    |> foreign_key_constraint(:article_id, name: :article_bindings_article_thread_fkey)
    |> unique_constraint(:inner_id, name: :article_bindings_community_inner_id_index)
  end
end
