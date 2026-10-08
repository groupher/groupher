defmodule GroupherServer.CMS.Model.Article do
  @moduledoc """
  Stable aggregate root for one logical Article across editing and publishing.

      Draft / Revision / Public
                 |
                 `-> stable Article id -> comments / stats / activity

  Content heads and lifecycle state deliberately live outside this schema.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.Author
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @threads CMS.Artiment.Config.threads()
  @moderation_states [:legal, :audit_failed, :illegal]
  @required_fields ~w(thread author_id moderation_state)a
  @optional_fields ~w(illegal_reason illegal_words active_at is_sunk last_active_at
                      is_edited comments_locked next_floor next_comment_inner_id)a

  @type t :: %__MODULE__{}

  schema "articles" do
    belongs_to(:author, Author, type: :id)
    field(:thread, Ecto.Enum, values: @threads)
    field(:moderation_state, Ecto.Enum, values: @moderation_states, default: :legal)
    field(:illegal_reason, {:array, :string}, default: [])
    field(:illegal_words, {:array, :string}, default: [])
    field(:active_at, :utc_datetime)
    field(:is_sunk, :boolean, default: false)
    field(:last_active_at, :utc_datetime)
    field(:is_edited, :boolean, default: false)
    field(:comments_locked, :boolean, default: false)
    field(:next_floor, :integer, default: 1)
    field(:next_comment_inner_id, :integer, default: 1)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds the stable identity and operational-state changeset for an Article."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = article, attrs) do
    article
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:next_floor, greater_than: 0)
    |> validate_number(:next_comment_inner_id, greater_than: 0)
    |> foreign_key_constraint(:author_id)
  end
end
