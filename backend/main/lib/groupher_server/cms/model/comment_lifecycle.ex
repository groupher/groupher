defmodule GroupherServer.CMS.Model.CommentLifecycle do
  @moduledoc """
  Materialized lifecycle authority for one Comment.

  A deleted Comment remains readable as a tombstone. Its parent Article and
  Community determine effective visibility and mutation capability separately.

  Business position:

      CMS Lifecycle
        -> CommentLifecycle schema
        -> PostgreSQL
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.Comment
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @states [:visible, :deleted, :destroy]
  @required_fields ~w(comment_id state version changed_at)a
  @optional_fields ~w(deleted_at destroyed_at)a

  @type state :: :visible | :deleted | :destroy
  @type t :: %__MODULE__{}

  schema "comment_lifecycles" do
    belongs_to(:comment, Comment)
    field(:state, Ecto.Enum, values: @states, default: :visible)
    field(:version, :integer, default: 1)
    field(:changed_at, :utc_datetime)
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
    |> foreign_key_constraint(:comment_id)
    |> unique_constraint(:comment_id)
  end
end
