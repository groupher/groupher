defmodule GroupherServer.CMS.Model.ArticleLifecycle do
  @moduledoc """
  Materialized lifecycle authority for one logical Article.

  `article_hash_id` identifies the logical Article across its draft/public
  version rows; `thread` selects the concrete Article table. Versioning owns
  physical rows and stages, while this schema owns the logical resource state.

  Business position:

      CMS Lifecycle
        -> ArticleLifecycle schema
        -> PostgreSQL
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @article_threads GroupherServer.CMS.Artiment.Config.threads() -- [:doc]
  @states [:draft_only, :published, :archived, :deleted, :destroy]
  @required_fields ~w(community_id thread article_hash_id state version changed_at)a
  @optional_fields ~w(archived_at deleted_at destroyed_at)a

  @type state :: :draft_only | :published | :archived | :deleted | :destroy
  @type t :: %__MODULE__{}

  schema "article_lifecycles" do
    belongs_to(:community, Community)
    field(:thread, Ecto.Enum, values: @article_threads)
    field(:article_hash_id, Ecto.UUID)
    field(:state, Ecto.Enum, values: @states, default: :draft_only)
    field(:version, :integer, default: 1)
    field(:changed_at, :utc_datetime)
    field(:archived_at, :utc_datetime)
    field(:deleted_at, :utc_datetime)
    field(:destroyed_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = lifecycle, attrs) do
    lifecycle
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:state, @states)
    |> validate_number(:version, greater_than: 0)
    |> foreign_key_constraint(:community_id)
    |> unique_constraint([:community_id, :thread, :article_hash_id])
  end
end
