defmodule GroupherServer.CMS.Model.ArticleLifecycle do
  @moduledoc """
  Materialized lifecycle authority for one stable Article aggregate.

  Business position:

      CMS Lifecycle
        -> ArticleLifecycle schema
        -> PostgreSQL
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Model.Article
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @article_threads CMS.Artiment.Threads.identity_values_list() -- [:doc]
  @states [:draft, :published, :archived, :deleted, :destroy]
  @required_fields ~w(article_id thread state version changed_at)a
  @optional_fields ~w(archived_at deleted_at destroyed_at)a

  @type state :: :draft | :published | :archived | :deleted | :destroy
  @type t :: %__MODULE__{}

  schema "article_lifecycles" do
    belongs_to(:article, Article, type: Ecto.UUID)
    field(:thread, Ecto.Enum, values: @article_threads)
    field(:state, Ecto.Enum, values: @states, default: :draft)
    field(:version, :integer, default: 1)
    field(:changed_at, :utc_datetime)
    field(:first_published_at, :utc_datetime, read_after_writes: true)
    field(:archived_at, :utc_datetime)
    field(:deleted_at, :utc_datetime)
    field(:destroyed_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds the Lifecycle changeset keyed by a stable Article."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = lifecycle, attrs) do
    lifecycle
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:state, @states)
    |> validate_number(:version, greater_than: 0)
    |> foreign_key_constraint(:article_id)
    |> unique_constraint(:article_id, name: :article_lifecycles_article_id_index)
  end
end
